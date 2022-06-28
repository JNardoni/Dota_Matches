
const Discord = require('discord.js');
const client = new Discord.Client();

//Grab login secrets for the database and disc bot info from an external file
const mysql = require("mysql");

var request = require('./secrets.js');

//Login using secrets
var con = mysql.createConnection({
    host: request.host,
    user: request.user,
    password: request.password,
    database: request.database
});

//Connect to the MySQL server
con.connect(err => {
    if (err) throw err;
    console.log("Connected To Database!");
});


//Log in as the Discord Bot
client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
});

client.login(request.discbot);

client.on('message', msg => {
    if (msg.content.substring(0, 1) === ('!')) {
        var body = msg.content;
        switch (msg.content) {
            case '!help':
                break;

            case ('!recent'):
                // con.query("SELECT * from dota WHERE MatchID = 6320988620;", (err, result) => {
                con.query("SELECT max(Date) from dota", (err, date) => {
                    if (err) {
                        throw err;
                    }
                    else {
                        msg.channel.send("The most recent update was " + date[0].body);
                    }
                });
                break;

            case '!exit':
                close();
            default:
                body = msg.content.substring(1).split('!');
                console.log(body);
                con.query('SELECT * FROM dota WHERE PlayerID = ' + body, (err, result) => {
                    if (err) {
                        throw err;
                    }
                    if (result.length > 0) {
                        for (var i = 0; i < result.length; i++) {
                            msg.channel.send("Match: " + result[i].MatchID + " | Date: " + result[i].Date);
                        }
                    }

                    else {
                        msg.channel.send("Never played with that PlayerID before");
                    }
                });
                break;
        }
    }
})
>>>>>>> Stashed changes
