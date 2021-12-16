/*
var http = require('http');
http.createServer(function (req, res) {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Hello World\n');
}).listen(1337, '127.0.0.1');
console.log('Server running at http://127.0.0.1:1337/');
*/


//Main globals, loaded in at the PRELOAD section
var lastMatchID;
var playerID;

//::::::::::::::::::::::CONNECTING TO THE MYSQL SERVER::::::::::::::::
var mysql = require('mysql');

var connection = mysql.createConnection({
    host: "localhost",
    user: "JSBot",
    password: "XXXX",
    database: "XXXX"
})

connection.connect(function (err) {
    if (err) throw err;
})

//:::::::::::::::::::::::::PRELOAD DATA FROM JSON FILE:::::::::::::::::::

const fs = require('fs');
const fileName = './storage.json' //File that stores releveant info to ensure not too many calls are made
const file = require(fileName); //Used later on to update the file

fs.readFile(fileName, 'utf8', (err, data) => { //Reads the filename setup, to load needed info
    if (err)
        throw err;
    else {
        const storageSetup = JSON.parse(data);

        lastMatchID = storageSetup.PlayerInfo.LastMatchID;  //Loads the lastMatchID, which keeps track of the last match added to the SQL file
        console.log("Last Match Parsed: " + lastMatchID);
        playerID = storageSetup.PlayerInfo.PlayerID;        //Loads the playerID, used for API calls to find your player info from OPENDOTA
        console.log("Player ID: "  +playerID);
    }
})

//:::::::::::::::::::::::::::MENU:::::::::::::::::::::::::

const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
});

function MenuLoop() {
    return new Promise(function (resolve, reject) {
        readline.setPrompt('What would you like to do?\n')
        readline.prompt();
        readline.on('line', function (line) {
            if (line === "exit" || line === "quit" || line == 'q') {
                readline.close()
                return // bail here, so rl.prompt() isn't called again
            }
            else if (line === "help" || line === '?') {
                console.log(`Commands List \n 1. "games" for match history\n 2. "exit" to exit`)
            }
            else if (line === "history") {
                SearchMatchHistory();
            }
            else if (line === "update") {
                GrabNewMatches();
            }
            else {
                console.log(`unknown command: "${line}". For command list, type "help"`)
            }
            readline.prompt()

        }).on('close', function () {
            console.log('bye')
            resolve(42) // this is the final result of the function
        });
    })
}

//Runs the main menu
async function run() {
    try {
        let menuloop = await MenuLoop()

    } catch (e) {
        console.log('failed:', e)
    }
}

run()

//::::::::::::::::::FUNCTIONS FOR UPDATING THE SQL DATABASE WITH MATCH HISTORY:::::::::::::::::
/*The SQL database keeps track of all matches played, and all opponenets in these matches.
 * It updates based on the playerID in the storage.json file
 * 
 * 
 * The variable lastMatchID keeps track of the most recent match the player with playerID has 
 * had added to the SQL database. 
 */
// By using the lastMatchID, CheckMatches is only run from the most recent match to the most recently added match
async function CheckMatches(parsed, i) {

    //A timeout is used as to not overflow API calls. 60 API calls may be made per minute, 
    //so a slightly longer than 1 second timeout is used to be safe
    setTimeout(function () {

        if (parsed[i] != null && parsed[i].match_id > lastMatchID) { //If the match returned from the API call is more recent that the most recently added match,
            console.log('Adding match ' + parsed[i].match_id);                         //then it adds the new match to the database
            AddMatchToDB(parsed[i].match_id);
            CheckMatches(parsed, i + 1);    //calls CheckMatch on the next most recent match
        }
        else {
            console.log('Done updating!');
        }
    }, 1200); 

}

//The API request players/playerid/matches returns an ENTIRE history of matches played, in order from most recent
//to oldest. By using the matchID, CheckMatches above is only run from the most recent match 
function GrabNewMatches() {
    const request = require('request');
    request('https://api.opendota.com/api/players/' + playerID + '/matches', function (error, response, body) {
        if (!error && response.statusCode == 200) {

            //Parse the player info
            var parsed = JSON.parse(body);

            //Update the last match ID in the storage JSON file
            file.PlayerInfo.LastMatchID = parsed[0].match_id; //Updates the JSON in program memory

            fs.writeFile(fileName, JSON.stringify(file), function writeJSON(err) { //Actually writes it to file
                if (err) return console.log(err);
            });
            CheckMatches(parsed, 0);  //Now it calls the CheckMatchs function to begin updating the SQL database with new matchs
                                      //Starts with the most recent match, Match 0
        }
    })
}


function AddMatchToDB(MatchID) {
    const request = require('request');
    request('https://api.opendota.com/api/matches/' + MatchID, function (error, response, body) {
        if (!error && response.statusCode == 200) {
           // 

            //Parse the player info
            var parsed = JSON.parse(body);

            var DidIWin = 0;
            for (var i = 0; i < 10; i++) {
                if (parsed.players[i].account_id === playerID) {
                    DidIWin = parsed.players[i].win;
                }
            }

            var d = new Date(parsed.start_time * 1000);

            //Makes an SQL call for every other player in the game
            for (var i = 0; i < 10; i++) {
                //console.log(i);

                if (parsed.players[i].account_id != null && parsed.players[i].account_id != playerID) {   //Doesnt add yourself to the database, as theres little point
                    connection.query("INSERT INTO dota VALUES (" +
                        parsed.players[i].account_id + ", " +
                        MatchID + ', ' +
                        parsed.players[i].win + ', ' +
                        DidIWin + ', ' +
                        parsed.players[i].hero_id + ', ' +
                        "'" + d.getDate() + '/' + (d.getMonth()) + '/' + d.getFullYear() + " " + d.getHours() + ':' + d.getMinutes() + "', " +
                        "'" + Math.floor(parsed.duration/60) + ':' + parsed.duration%60  + "');", function (err, result, fields) {
                            if (err) throw err;// if any error while executing above query, throw error

                    });
                }
            }
            console.log('Done with match ' + MatchID);
            //Starts with the most recent match, Match 0
        }
    })
}
// console.log(parsed.players[0].account_id);




//::::::::::::::::::::FUNCTIONS FOR SEARCHING THE DATABASE MATCH HISTORY:::::::::::::::::::::::


function SearchMatchHistory() {
    connection.query("SELECT * FROM dota", function (err, result, fields) {
        // if any error while executing above query, throw error
        if (err) throw err;
        // if there is no error, you have the result
        console.log(result);
    });
}







