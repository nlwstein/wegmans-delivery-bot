const fetch = require("node-fetch");
const fs = require("fs");
const config = JSON.parse(fs.readFileSync("config.json"));
const twilio = require("twilio")(
  config.twilio.accountSid,
  config.twilio.authToken
);

function renewSession(callback) {
  fetch(new URL(config.instacart.loginUrl), {
    method: "POST",
    body: JSON.stringify({
      grant_type: "password",
      email: config.instacart.username,
      password: config.instacart.password,
    }),
    headers: { "Content-Type": "application/json" },
  })
    .then((response) => {
      // console.log(response.headers); process.exit();
      var session = response.headers
        .raw()
        ["set-cookie"].filter((cookie) =>
          cookie.startsWith("_instacart_session")
        )[0];
      fs.writeFileSync(".instacartsession", session);
      return response.json();
    })
    .then(function (response) {
      if (response.status == "ok") {
        callback();
      } else {
        console.error("Failed to login to Instacart! Exiting.");
        process.exit();
      }
    });
}

function dumpOrder(alreadyAttemptedLogin) {
  if (!process.argv[2]) {
    fetch(new URL(config.instacart.dumpOrderListUrl), {
      method: "GET",
      headers: {
        Cookie: fs.readFileSync(".instacartsession"),
      },
    })
      .then((response) => response.json())
      .then(function (orders) {
        orders.orders.forEach((order) => {
          console.log(
            order.status + " - " + order.id + " - " + order.created_at
          );
        });
      });
  } else {
    fetch(new URL(config.instacart.dumpOrderUrl + process.argv[2]), {
      method: "GET",
      headers: {
        Cookie: fs.readFileSync(".instacartsession"),
      },
    })
      .then((response) => response.json())
      .then(function (order) {
        order.order.order_deliveries.forEach((delivery) => {
          delivery.order_items.forEach((item) => {
            console.log(item.qty + " - " + item.item.name);
          });
        });
      })
      .catch(function (e) {
        if (alreadyAttemptedLogin) {
          throw e;
        } else {
          renewSession(() => dumpOrder(true));
        }
      });
  }
}

if (fs.existsSync(".instacartsession")) {
  dumpOrder(false);
} else {
  renewSession(() => dumpOrder(true));
}
