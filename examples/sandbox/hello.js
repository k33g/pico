const {Service, DiscoveryBackend} = require('../../index')

let port = process.env.PORT || 9090;
let externalPort = process.env.EXTERNAL_PORT || port;

let discoveryBackend = new DiscoveryBackend({
  protocol:`http`, 
  host:`localhost`,
  port:9099,
  keyServices:"domain-demo"
})

let record = {
  name: "hello",
  domain: `http://localhost:${externalPort}`,
  root:"/api",
  methods: [
    {name: "hello1", type: "GET", path: "/hello"},
    {name: "hello2", type: "POST", path: "/hello"}],
  metadata: {
    kind: "http"
  }
}

let service = new Service({discoveryBackend: discoveryBackend, record: record})

service.stop = (cause) => {
  console.log(`👋 ${service.record.registration} ${cause}`)
}

service.get({uri:`/api/hello`, f: (request, response) => {
  response.sendJson({message: "Hello 🌍", from:"pico", result: request.params[0]+request.params[1]})

}})

service.post({uri:`/api/hello`, f: (request, response) => {
  let data = request.body
  response.sendJson({message: "👋 ✉️ received", from:"pico" , result: data.a + data.b})
  
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
          Success: port => {

            service.record.metadata.message = "Hey 👋! What's up?"
            
            service.updateRegistration(res => {
              res.when({
                Failure: error => console.log("😡 updateRegistration", error),
                Success: value => console.log("😍", value)
              })
            })

            console.log(`🌍 pico service ${record.name} is listening on ${port}`)
          }
        })
      })
      /* service is started */
    }
  })
})

// tests
// ab -n 10000 http://localhost:9090/api/bob/yo