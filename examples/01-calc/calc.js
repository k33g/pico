const {Service} = require('../../index')

let calcService = new Service({})

let port = process.env.PORT || 9090;

/**
 * usage: curl http://localhost:9090/api/add/40/2
 */
calcService.get({uri:`/api/add`, f: (request, response) => {
  let a = parseInt(request.params[0])
  let b = parseInt(request.params[1])
  response.sendJson({message: "Hello 🌍", from:"pico", result: a + b})
}})

/**
 * usage: curl -H "Content-Type: application/json" -X POST -d '{"a":21,"b":21}' http://localhost:9090/api/add
 */
calcService.post({uri:`/api/add`, f: (request, response) => {
  let data = request.body
  response.sendJson({message: "Hey 👋", from:"pico" , result: data.a + data.b})
}})

calcService.start({port: port}, res => {
  res.when({
    Failure: error => console.log("😡 Houston? We have a problem!"),
    Success: port => console.log(`🌍 calcService is listening on ${port}`)
  })
})
