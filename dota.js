/*
var http = require('http');
http.createServer(function (req, res) {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Hello World\n');
}).listen(1337, '127.0.0.1');
console.log('Server running at http://127.0.0.1:1337/');
*/

var mysql = require('mysql');
var lastMatchId = 0;
var parsed;

var connection = mysql.createConnection({
    host: "localhost",
    user: "JSBot",
    password: "password",
    database: "db"
})

connection.connect(function (err) {
    if (err) throw err;
    //console.log("Connected!\n");

})

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

async function run() {
    try {
        let replResult = await MenuLoop()

    } catch (e) {
        console.log('failed:', e)
    }
}

run()


/*
var menuLoop = function () {

    return new Promise(function)




    readline.question('What would you like to do?\n', name => {
        if (name === 'hi') {
            SearchMatchHistory();
        }
        if (name === 'exit') {
            readline.close();
        }
        //menuLoop();
    });
}

menuLoop();*/

/*
async function main() {

    //while (1) {

        readline.question("What would you like to do?", name => {
            console.log("ok!")

            if (name === 'hi') {
                SearchMatchHistory();

                main();
            }

            else {// (name == 'print') {
                connection.destroy();
            }
            readline.close();
        })

    //}

}
*/


async function CheckMatches(i) {



    setTimeout(function () {
        if (parsed[i] != null && parsed[i].match_id > lastMatchId) {
            console.log(parsed[i].match_id);
            CheckMatches(i + 1);
        }
    }, 10000);


}


function GrabNewMatches() {
    const request = require('request');
    request('https://api.opendota.com/api/players/XXXXXX/matches', function (error, response, body) {
        if (!error && response.statusCode == 200) {
           // console.log(body) // Print the google web page.

            parsed = JSON.parse(body);

            CheckMatches(0);
   
        }
    })


}
// console.log(parsed.players[0].account_id);

function SearchMatchHistory() {
    connection.query("SELECT * FROM dota", function (err, result, fields) {
        // if any error while executing above query, throw error
        if (err) throw err;
        // if there is no error, you have the result
        console.log(result);
    });
}







