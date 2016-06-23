# Setup

Install the necessary modules

    npm install
  
Run the server (defaults to port 4000)

    node app.js


# Example usage

List all available feeds

    curl http://localhost:4000/api/feeds

Response

    [{"id":"119101367","subscribe":{"uri":"/api/subscribe/119101367","method":"POST"}}]

Obtain an endpoint to subscribe to

    curl -X POST http://localhost:4000/api/subscribe/119101367

Response

    {"firstPTS":209.96266666666668,"sessionid":"b0UDmqns9WcVAAs6eNAP6fZx","nextadbreak":{"uri":"/api/subscribe/119101367/session/b0UDmqns9WcVAAs6eNAP6fZx","method":"GET"}}

"Listen" for next ad break

    curl http://localhost:4000/api/subscribe/119101367/session/b0UDmqns9WcVAAs6eNAP6fZx
  
Response

    {"sessionFirstGlobalPTS":209.96266666666668,"start":{},"stop":{}}
