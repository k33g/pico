const {Client, DiscoveryBackend} = require('../../index')

let discoveryPort = process.env.DISCOVERY_PORT || 9099;

let discoveryBackend = new DiscoveryBackend({
  protocol:`http`, 
  host:`localhost`,
  port:discoveryPort,
  keyServices:"domain-demo"
})


discoveryBackend.getServices({filter: service => service.name == "calc" },  results => {
  results.when({
    Failure: error => console.log("😡 Houston? We have a problem!", error),
    Success: servicesRecords => {
      let selectedService = servicesRecords[0] // get the first service with a name == "calc"
      // create a client from the record
      let client = new Client({service: selectedService})
      
      // check that the service is ok and then call the service methods by name
      client.healthCheck().then(check => {

        console.log(check)
        
        client.callMethod({name:"add1", urlParams:[40,2]}).then(res => console.log(res)) // GET picoservice

        client.callMethod({name:"add2", data:{a:21, b: 21} }).then(res => console.log(res)) // POST picoservice
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


