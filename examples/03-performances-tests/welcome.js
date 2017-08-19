const {Service} = require('../../index')

let port = process.env.PORT || 4000;
let externalPort = process.env.EXTERNAL_PORT || port;

let service = new Service({})

service.get({uri:`/api/welcome`, f: (request, response) => {
  response.sendJson({message:"Welcome", from:"Pico"})
}})

service.start({port: port}, res => {
  res.when({
    Failure: error => console.log("😡 Houston? We have a problem!", error),
    Success: port => console.log(`🌍 pico service is listening on ${port}`)
  })
})

// tests
//  ab -n 10000 -c 10 http://localhost:4000/api/welcome/