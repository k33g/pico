const {Service, Client, DiscoveryBackend} = require('../../index')

let port = process.env.PORT || 9093;
let externalPort = process.env.EXTERNAL_PORT || port;

let discoveryBackend = new DiscoveryBackend({
  protocol:`http`, 
  host:`localhost`,
  port:9099,
  keyServices:"domain-demo"
})

let record = {
  name: "ola",
  domain: `http://localhost:${externalPort}`,
  root:"/api",
  methods: [
    {name: "ola-1", type: "GET", path: "/ola"},
    {name: "ola-2", type: "POST", path: "/ola"}],
  metadata: {
    kind: "http"
  }
}

let service = new Service({discoveryBackend: discoveryBackend, record: record})


discoveryBackend.getServices({},  results => {
  results.when({
    Failure: error => console.log("😡 Houston? We have a problem!", error),
    Success: data => {
      console.log("get all Services", data)
    }
  })
})

// with filter
discoveryBackend.getServices({filter: service => service.name == "hello" },  results => {
  results.when({
    Failure: error => console.log("😡 Houston? We have a problem!", error),
    Success: data => {
      console.log("get some Services", data)
      let selectedService = data[0]
      let client = new Client({service: selectedService})
      //console.log(client)
      // --- here call service ---
      client.healthCheck().then(res => {
        console.log("calling methods...")
        client.callMethod({name:"hello1", urlParams:[40,2]}).then(res => console.log(res)) // GET picoservice
        client.callMethod({name:"hello2", data:{a:21, b: 21} }).then(res => console.log(res)) // POST picoservice
      })
    }
  })
})

discoveryBackend.healthcheck(results => {
  results.when({
    Failure: error => console.log("😡 Houston? We have a problem!", error),
    Success: data => console.log("😁 DiscoveryBackend is", data)
  })
})


service.stop = (cause) => {
  console.log(`👋 ${service.record.registration} ${cause}`)
}

service.get({uri:`/api/ola`, f: (request, response) => {
  console.log(request.params)  
  response.sendJson({message: "Ola 🌍", from:"pico"})

}})

service.post({uri:`/api/ola`, f: (request, response) => {
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
          Success: port => {

            service.record.status = "UP"

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