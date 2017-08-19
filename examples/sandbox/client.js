const {Service, fetch} = require('../../index')

fetch({
  protocol:"http",
  host: "localhost",
  port: 9090,
  path: "/api/hello/yop/yop",
  method: 'GET',
  headers:  {"Content-Type": "application/json; charset=utf-8"}
}).then(data => {
  console.log(data)
}).catch(err => console.log(err))

fetch({
  protocol:"http",
  host: "localhost",
  port: 9090,
  path: "/api/hello",
  method: 'POST',
  data:JSON.stringify({message: "👋 hey! It's me"}),
  headers:  {"Content-Type": "application/json; charset=utf-8"}
}).then(data => {
  console.log(data)
}).catch(err => console.log(err))