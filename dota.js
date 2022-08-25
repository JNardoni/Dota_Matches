

//Main globals, loaded in at the PRELOAD section
//var lastMatchID;
//var playerID;

//::::::::::::::::::::::CONNECTING TO THE MYSQL SERVER::::::::::::::::
var mysql = require('mysql');

//Database and Player info
var secrets = require('./secrets.js');

var connection = mysql.createConnection({
    host: secrets.host,
    user: secrets.user,
    password: secrets.password,
    database: secrets.database
})

connection.connect(function (err) {
    if (err) throw err;
})

//:::::::::::::::::::::::::PRELOAD DATA FROM JSON FILE:::::::::::::::::::
var storageSetup;
const fs = require('fs');
const fileName = './storage.json' //File that stores releveant info to ensure not too many calls are made
const file = require(fileName); //Used later on to update the file

fs.readFile(fileName, 'utf8', (err, data) => { //Reads the filename setup, to load needed info
    if (err)
        throw err;
    else {
        storageSetup = JSON.parse(data);
      //  set = storageSetup;
        lastMatchID = secrets.LastMatchID;  //Loads the lastMatchID, which keeps track of the last match added to the SQL file
        console.log("Last Match Parsed: " + lastMatchID);
        playerID = secrets.PlayerID;        //Loads the playerID, used for API calls to find your player info from OPENDOTA
        console.log("Player ID: " + playerID);
        lastHeroID = secrets.LastHeroID;  //Loads the last match for thee individual heroes
        console.log("Last Hero WR Update: " + lastHeroID);

     //   console.log(storageSetup.Heroes[1]);
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
                return // bail
            }
            else if (line === "help" || line === '?') {
                console.log(`Commands List \n 1. "games" for match history\n 2. "update" to update the match history"\n 3. "exit" to exit`)
            }
            else if (line === "history" || line === "games") {
                SearchMatchHistory();
            }
            else if (line === "update") {
                GrabNewMatches();
            }
            else if (line === "heroes") {
                GrabMyHeroes();
            }
        /*    else if (line == "hero") {
                for (var j = 136; j > 0; j--) {
                    connection.query("UPDATE dota SET Hero = REPLACE(Hero, '" +
                        j + "', '" + storageSetup.Heroes[j] + "');", function (err, result, fields) {

                            if (err) throw err;// if any error while executing above query, throw error
                        });
                }
            }*/
            else {
                console.log(`unknown command: "${line}". For command list, type "help"`)
            }
            readline.prompt()

        }).on('close', function () {
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


//::::::::::::::::::FUNCTIONS FOR UPDATING THE SQL DATABASE WITH MY HERO HISTORY:::::::::::::::::
/**
 * Breaks down my individual heroes to make more dynamic recommendations
 *
 */

function GrabMyHeroes() {
    const request = require('request');
    request('https://api.opendota.com/api/players/' + playerID + '/matches', function (error, response, body) {
        if (!error && response.statusCode == 200) {
            var parsed = JSON.parse(body);

            var i = 0;

                //All info is contained in a single RESTful call. Pulls all the needed info from there
                while (parsed[i] != undefined && parsed[i].match_id > lastHeroID) {

                    console.log('Adding match ' + parsed[i].match_id);

                    //Slight delay to make sure multiple versions of the same tables arent being made
                    AddToHeroDB(parsed[i]);

                    i++;                                        
                }

            //Update the last pulled ID
            secrets.LastHeroID = parsed[0].match_id; //Updates the ID in program memory
        }
    });
}

//Adds the hero info to the database. Will create the table if needed, then add the hero
function AddToHeroDB(parsed) {

    if (parsed === undefined) {
        return;
    }

    if (parsed.leaver_status == 1 || parsed.game_mode != 22) {
        console.log('Invalid match');
        return;
    }

    //Check to seee if the Hero Table exists. If not, create it
    connection.query('SELECT * FROM ' + storageSetup.Heroes[parsed.hero_id], function (err, res, fields) {
        if (err) {
            connection.query('CREATE TABLE ' + storageSetup.Heroes[parsed.hero_id] +
                ' (Kills int NOT NULL, Deaths int NOT NULL, Assists int NOT NULL, Win tinyint(1) NOT NULL);');
        }
    });
    
    //Check to see if the match was a victory of not. Can only compare to radiant
    var DidIWin = 0;
    if ((parsed.radiant_win == 1 && parsed.player_slot < 5) || (parsed.radiant_win != 1 && parsed.player_slot > 4)) {
        DidIWin = 1;
    }
    
   //Add the info to the hero table
    connection.query("INSERT INTO " + storageSetup.Heroes[parsed.hero_id]  + " VALUES (" +
        parsed.kills + ", " +
        parsed.deaths + ', ' +
        parsed.assists + ', ' +
        DidIWin + ')', function (err, result, fields) {
            if (err) throw err;// if any error while executing above query, throw error

        });

    console.log('Sucesfully added match');

}


//::::::::::::::::::FUNCTIONS FOR UPDATING THE SQL DATABASE WITH MATCH HISTORY:::::::::::::::::
/*The SQL database keeps track of all matches played, and all opponenets in these matches.
 * It updates based on the playerID in the storage.json file
 * 
 * 
 * The variable lastMatchID keeps track of the most recent match the player with playerID has 
 * had added to the SQL database. 
 */

//The API request players/playerid/matches returns an ENTIRE history of matches played, in order from most recent
//to oldest. By using the matchID, CheckMatches above is only run from the most recent match 
function GrabNewMatches() {
    const request = require('request');
    request('https://api.opendota.com/api/players/' + playerID + '/matches', function (error, response, body) {
        if (!error && response.statusCode == 200) {

            //Parse the player info
            var parsed = JSON.parse(body);

            //Update the last match ID in the storage JSON file
            secrets.LastMatchID = parsed[0].match_id; //Updates the JSON in program memory

            fs.writeFile(fileName, JSON.stringify(file), function writeJSON(err) { //Actually writes it to file
                if (err) return console.log(err);
            });
            CheckMatches(parsed, 0);  //Now it calls the CheckMatchs function to begin updating the SQL database with new matchs
                                      //Starts with the most recent match, Match 0
        }
    })
}

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

function AddMatchToDB(MatchID) {
    const request = require('request');
    request('https://api.opendota.com/api/matches/' + MatchID, function (error, response, body) {
        if (!error && response.statusCode == 200) {
            //Parse the player info
            var parsed = JSON.parse(body);

            //Checks to make sure that 10 people are in the game. If not, the game is canceled
            if (parsed.players[9] === undefined) {
                console.log('Players are undefined. Match ' + MatchID + ' aborted');
                return;
            }

            //Finds the user. This is important for two reasons.
            //1. To not flood the database with your own stats.
            //2. To know if you won the game or not. Better to judge people knowing they won/lost
            var DidIWin = 0;
            for (var i = 0; i < 10; i++) {
                if (parsed.players[i].account_id === Number(playerID)) {
                    DidIWin = parsed.players[i].win;
                }
            }

            //Establishes the date/time the game was played
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
                        storageSetup.Heroes[parsed.players[i].hero_id] + ', ' +
                        "'" + d.getMonth() + '/' + (d.getDate()) + '/' + d.getFullYear() + " " + d.getHours() + ':' + d.getMinutes() + "', " +
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



//  Allows the user to input player ids, which are looked up in the match history, and the info is given back to the user
//          Params: None
//          Returns: None
function SearchMatchHistory() {

    var entry = "";

    //Continues until the user exits
    while (entry != "exit") {

        //Prompt to get an input for searching
        readline.setPrompt('Searching your match history! Enter a player id to see, or type "exit" to exit\n');
        readline.prompt();

        readline.on('line', function (line) {

            if (line === "exit" || line === "quit" || line == 'q') {  //If exit, quits the loop and returns to the main menu
                entry = "exit";
            }
            else if (isNumeric(line)) { //Checks if the input is numeric or not. playerid is always a number, which allows this to both save time if a non-number is entered,
                // and disallow and SQL injection
                connection.query("SELECT * FROM dota WHERE playerID =" + line, function (err, result, fields) {
                    // if any error while executing above query, throw error
                    if (err) throw err;
                    // if there is no error, you have the result
                    console.log(result);
                })
            }
            else {
                console.log("Not a valid player id\n");
            }
        });
    }
}

// Checks whether a variable is numeric or not. Returns true if numeric, false if not
//      Params: String var
//      Returns: Bool
function isNumeric(line) {
    return parseInt(line);


}
