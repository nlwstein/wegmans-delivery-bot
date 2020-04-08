const fetch = require('node-fetch')
const fs = require('fs')
const config = JSON.parse(fs.readFileSync('config.json'))
const twilio = require('twilio')(config.twilio.accountSid, config.twilio.authToken);

function renewSession(callback) {
    fetch(new URL(config.instacart.loginUrl), { 
        method: "POST",
        body: JSON.stringify({
            grant_type: "password",
            email: config.instacart.username,
            password: config.instacart.password,
        }),
        headers: { 'Content-Type': 'application/json' }
    }).then(response => {
        // console.log(response.headers); process.exit(); 
        var session = response.headers.raw()['set-cookie'].filter(cookie => cookie.startsWith('_instacart_session'))[0];
        fs.writeFileSync('.instacartsession', session); 
        return response.json(); 
    }).then(function (response) {
        if (response.status == 'ok') {
            callback(); 
        } else {
            console.error('Failed to login to Instacart! Exiting.')
            process.exit();
        }
    })
}

function checkAvailability(alreadyAttemptedLogin) {
    console.log(config.instacart.availabilityUrl); 
    fetch(new URL(config.instacart.availabilityUrl), {
        method: "GET",
        headers: {
            "Cookie": fs.readFileSync('.instacartsession'),
        }
    }).then(response => response.json()).then(function (response) {
        if (response.container.modules[0].data.title == "No delivery times available") {
            console.log("No delivery times appear to be available."); 
            process.exit(); 
        } else {
            console.log("Delivery times MAY be available - response data: " + JSON.stringify(response)); 
            config.twilio.recipientNumbers.forEach(recipient => {
                twilio.messages
                    .create({
                        body: 'Wegmans delivery via Instacart MAY be available!',
                        from: config.twilio.twilioNumber,
                        to: recipient
                    })
                    .then(message => console.log('Message sent - ' + message.sid));
            });
            
        }
    }).catch(function (e) {
        if (alreadyAttemptedLogin) {
            throw e;
        } else {
            renewSession(() => checkAvailability(true));
        }
    })
}

if (fs.existsSync('.instacartsession')) {
    checkAvailability(false)
} else {
    renewSession(() => checkAvailability(true)); 
}