const {Service, DiscoveryBackend} = require('../../index')

let port = process.env.PORT || 9092;
let externalPort = process.env.EXTERNAL_PORT || port;

let service = new Service({})

service.get({uri:`/api/hi`, f: (request, response) => {
  console.log(request.params)  
  response.sendJson({message: "Hi 👋 🌍", from:"pico"})

}})

service.post({uri:`/api/hi`, f: (request, response) => {
  console.log(request.body)  
  response.sendJson({message: "👋 ✉️ received", from:"pico"})
  
}})


service.start({port: port}, res => {
  res.when({
    Failure: error => console.log("😡 Houston? We have a problem!", error),
    Success: port => console.log(`🌍 pico service is listening on ${port}`)
  })
})

// tests
// ab -n 10000 http://localhost:9090/api/bob/yo