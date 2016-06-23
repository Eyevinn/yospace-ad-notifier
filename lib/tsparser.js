const PESTIMESCALE = 90000;

function _parsePAT(listener, data, offset) {
  var pmtId = (data[offset+10] & 0x1F) << 8 | data[offset+11];
  // skip the PSI header and parse the first PMT entry
  //console.log('PMT PID: ' + pmtId);
  return pmtId;
}

function _parsePMT(listener, data, offset, pmtobj) {
  var sectionLength, tableEnd, programInfoLength, pid;
  sectionLength = (data[offset+1] & 0x0f) << 8 | data[offset+2];
  tableEnd = offset + 3 + sectionLength - 4;
  // to determine where the table is, we have to figure out how
  // long the program info descriptors are 
  programInfoLength = (data[offset+10] & 0x0f) << 8 || data[offset+11];
  // advance the offset to the first entry in the mapping table
  offset += 12 + programInfoLength;

  while(offset < tableEnd) {
    pid = (data[offset+1] & 0x1F) << 8 | data[offset+2];
    switch (data[offset]) {
      case 0x0f:
        if (listener.aacTrack.id === -1) {
          listener.aacTrack.id = pid;
        } 
        break;
      // Packetized metadata (ID3)
      case 0x15:
        //console.log('ID3 PID:' + pid);
        listener.id3Track.id = pid;
        break;
      case 0x1b:
        if (listener.avcTrack.id === -1) {
          listener.avcTrack.id = pid;
        }
        break;
      default:
        //console.log('Unknown stream type: ' + data[offset]);
        break;
    }
    offset += ((data[offset+3] & 0x0F) << 8 | data[offset+4]) +5;
  }
}

function _parsePES(stream) {
  var i = 0, frag, pesFlags, pesPrefix, pesLen, pesHdrLen, pesData, pesPts, pesDts, payloadStartOffset, data = stream.data;
    //retrieve PTS/DTS from first fragment
    frag = data[0];
    pesPrefix = (frag[0] << 16) + (frag[1] << 8) + frag[2];
    if (pesPrefix === 1) {
      pesLen = (frag[4] << 8) + frag[5];
      pesFlags = frag[7];
      if (pesFlags & 0xC0) {
        /* PES header described here : http://dvd.sourceforge.net/dvdinfo/pes-hdr.html
            as PTS / DTS is 33 bit we cannot use bitwise operator in JS,
            as Bitwise operators treat their operands as a sequence of 32 bits */
        pesPts = (frag[9] & 0x0E) * 536870912 +// 1 << 29
          (frag[10] & 0xFF) * 4194304 +// 1 << 22
          (frag[11] & 0xFE) * 16384 +// 1 << 14
          (frag[12] & 0xFF) * 128 +// 1 << 7
          (frag[13] & 0xFE) / 2;
          // check if greater than 2^32 -1
          if (pesPts > 4294967295) {
            // decrement 2^33
            pesPts -= 8589934592;
          }
        if (pesFlags & 0x40) {
          pesDts = (frag[14] & 0x0E ) * 536870912 +// 1 << 29
            (frag[15] & 0xFF ) * 4194304 +// 1 << 22
            (frag[16] & 0xFE ) * 16384 +// 1 << 14
            (frag[17] & 0xFF ) * 128 +// 1 << 7
            (frag[18] & 0xFE ) / 2;
          // check if greater than 2^32 -1
          if (pesDts > 4294967295) {
            // decrement 2^33
            pesDts -= 8589934592;
          }
        } else {
          pesDts = pesPts;
        }
      }
      pesHdrLen = frag[8];
      payloadStartOffset = pesHdrLen + 9;

      stream.size -= payloadStartOffset;
      //reassemble PES packet
      pesData = new Uint8Array(stream.size);
      while (data.length) {
        frag = data.shift();
        var len = frag.byteLength;
        if (payloadStartOffset) {
          if (payloadStartOffset > len) {
            // trim full frag if PES header bigger than frag
            payloadStartOffset-=len;
            continue;
          } else {
            // trim partial frag if PES header smaller than frag
            frag = frag.subarray(payloadStartOffset);
            len-=payloadStartOffset;
            payloadStartOffset = 0;
          }
        }
        pesData.set(frag, i);
        i+=len;
      }

      return {data: pesData, pts: pesPts, dts: pesDts, len: pesLen};
    } else {
      return null;
    }
}

function _parseAACPES(listener, pes) {
  var startOffset = 0;
  var len, offset; 
  var data = pes.data;
  var pts = pes.pts;
  var aacSample;
  var headerLength, frameLength, frameIndex, frameDuration;
  var stamp;
  var aacOverflow = listener.aacOverflow;
  var aacLastPTS = listener.aacLastPTS;

  if (aacOverflow) {
    var tmp = new Uint8Array(aacOverflow.byteLength + data.byteLength);
    tmp.set(aacOverflow, 0);
    tmp.set(data, aacOverflow.byteLength);
    data = tmp;
  }

  // look for ADTS header (0xFFFx)
  for (offset = startOffset, len = data.length; offset < len - 1; offset++) {
    if ((data[offset] === 0xff) && (data[offset+1] & 0xf0) === 0xf0) {
      break;
    }
  }

  var adtsSampleingRates = [
            96000, 88200,
            64000, 48000,
            44100, 32000,
            24000, 22050,
            16000, 12000,
            11025, 8000,
            7350];
  var adtsSampleingIndex = ((data[offset + 2] & 0x3C) >>> 2);

  frameIndex = 0;
  frameDuration = 1024 * 90000 / adtsSampleingRates[adtsSampleingIndex];

  // if last AAC frame is overflowing, we should ensure timestamps are contiguous:
  // first sample PTS should be equal to last sample PTS + frameDuration
  if(aacOverflow && aacLastPTS) {
    var newPTS = aacLastPTS + frameDuration;
    if(Math.abs(newPTS-pts) > 1) {
      pts = newPTS;
    }
  }

  if(listener.aacTrack.initPTS == null) {
    listener.aacTrack.initPTS = pts;
  }

  while ((offset + 5) < len) {
   // The protection skip bit tells us if we have 2 bytes of CRC data at the end of the ADTS header
    headerLength = (!!(data[offset + 1] & 0x01) ? 7 : 9);
    // retrieve frame size
    frameLength = ((data[offset + 3] & 0x03) << 11) |
                   (data[offset + 4] << 3) |
                  ((data[offset + 5] & 0xE0) >>> 5);
    frameLength  -= headerLength;
    //stamp = pes.pts;

    if ((frameLength > 0) && ((offset + headerLength + frameLength) <= len)) {
      stamp = pts + frameIndex * frameDuration;
      aacSample = {unit: data.subarray(offset + headerLength, offset + headerLength + frameLength), pts: stamp, dts: stamp, npts: (stamp - listener.aacTrack.initPTS) / PESTIMESCALE };
      listener.aacTrack.samples.push(aacSample);
      listener.aacTrack.len += frameLength;
      offset += frameLength + headerLength;
      frameIndex++;
      // look for ADTS header (0xFFFx)
      for ( ; offset < (len - 1); offset++) {
        if ((data[offset] === 0xff) && ((data[offset + 1] & 0xf0) === 0xf0)) {
          break;
        }
      }
    } else {
      break;
    }
  }
  if (offset < len) {
    aacOverflow = data.subarray(offset, len);
    console.log('AAC overflow detected');
  } else {
    aacOverflow = null;
  }
  listener.aacOverflow = aacOverflow;
  listener.aacLastPTS = stamp;
}

function _parseID3PES(listener, pes) {
  listener.id3Track.samples.push(pes);
}


module.exports.validTS = function(data) {
  // a TS fragment should contain at least 3 TS packets, a PAT, a PMT, and one PID, each starting with 0x47
  if (data.length >= 3*188 && data[0] === 0x47 && data[188] === 0x47 && data[2*188] === 0x47) {
     return true;
  } else {
     return false;
  }
};

module.exports.parseTSPackets = function(listener, fragment, data) {
  var len = data.length;
  var starti, stt, pid, atf, offset;

  var pmt = {
    id: -1,
    parsed: false
  };
  var id3Data;
  var aacData;
  var avcData;

  // https://en.wikipedia.org/wiki/MPEG_transport_stream
  // PID : Packet Identifier
  // don't parse last TS packet if incomplete
  len -= len % 188;
  // loop through TS packets
  for (start=0; start<len; start += 188) {
    if (data[start] === 0x47) { // Sync byte
      stt = !!(data[start + 1] & 0x40);
      // pid is a 13-bit field starting at the last bit of TS[1]
      pid = ((data[start + 1] & 0x1f) << 8) + data[start + 2];
      atf = (data[start + 3] & 0x30) >> 4;
      // if an adaption field is present, its length is specified by the fifth byte of the TS packet header.
      if (atf > 1) {
        offset = start + 5 + data[start + 4];
        // continue if there is only adaptation field
        if (offset === (start + 188)) {
          continue;
        }
      } else {
        offset = start + 4;
      }
      if (pmt.parsed) { 
        if (pid === listener.avcTrack.id) {
          // We don't care about the video now
        } else if (pid === listener.aacTrack.id) {
          if (stt) {
            if (aacData) {
              _parseAACPES(listener, _parsePES(aacData));
            }
            aacData = {data: [], size: 0};
          }
          if (aacData) {
            aacData.data.push(data.subarray(offset, start + 188));
            aacData.size += start + 188 - offset;
          }
        } else if (pid === listener.id3Track.id) {
          if (stt) {
            //console.log("pid: "+pid+" === id3.id: "+HLSID3.id3Track.id);
            if (id3Data) {
              _parseID3PES(listener, _parsePES(id3Data));
              fragment.hasID3 = true;
            }
            id3Data = {data: [], size: 0};
          }
          if (id3Data) {
            id3Data.data.push(data.subarray(offset, start + 188));
            id3Data.size += start + 188 - offset;
          }
        }
      } else {
        if (stt) {
          offset += data[offset] + 1;
        }
        if (pid === 0) {
          // Parse PAT (Program Association Table)
          pmt.id = _parsePAT(listener, data, offset);
        } else if (pid === pmt.id) {
          // Parse PMT (Program Map Tables)
          _parsePMT(listener, data, offset, pmt);
          pmt.parsed = true;
          //console.log('PMT parsed', listener.id3Track.id, listener.aacTrack.id, listener.avcTrack.id);
        }
      }
    } else {
      console.log('MEDIA ERROR: TS packet did not start with 0x47');
    }
  }

  // Parse last PES packet
  if (id3Data) {
    _parseID3PES(listener, _parsePES(id3Data));
    fragment.hasID3 = true;
  }
  if (aacData) {
    _parseAACPES(listener, _parsePES(aacData));
  }
}

