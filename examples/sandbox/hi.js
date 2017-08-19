const {Service, DiscoveryBackend} = require('../../index')

let port = process.env.PORT || 9091;
let externalPort = process.env.EXTERNAL_PORT || port;

let discoveryBackend = new DiscoveryBackend({
  protocol:`http`, 
  host:`localhost`,
  port:9099,
  keyServices:"domain-demo"
})

let record = {
  name: "hi",
  domain: `http://localhost:${externalPort}`,
  root:"/api",
  methods: [
    {name: "hi-1", type: "GET", path: "/hi"},
    {name: "hi-2", type: "POST", path: "/hi"}],
  metadata: {
    kind: "http"
  }
}

let service = new Service({discoveryBackend: discoveryBackend, record: record})

service.stop = (cause) => {
  console.log(`👋 ${service.record.registration} ${cause}`)
}

service.get({uri:`/api/hi`, f: (request, response) => {
  console.log(request.params)  
  response.sendJson({message: "Hi 👋 🌍", from:"pico"})

}})

service.post({uri:`/api/hi`, f: (request, response) => {
  console.log(request.body)  
  response.sendJson({message: "👋 ✉️ received", from:"pico"})
  
}})

service.createRegistration(res => {
  res.when({
    Failure: (err) => console.log("🙀", err),
    Success: value => {
      console.log("😻 registration ok", value)
      /* starting the service */
      service.start({port: port}, res => {
        res.when({
          Failure: error => console.log("😡 Houston? We have a problem!"),
          Success: port => console.log(`🌍 pico service ${record.name} is listening on ${port}`)
        })
      })
      /* service is started */
    }
  })
})

// tests
// ab -n 10000 http://localhost:9090/api/bob/yo