#!/usr/bin/nodejs

var fs = require('fs');
var readline = require('readline');
var google = require('googleapis');
var googleAuth = require('google-auth-library');
var chalk = require('chalk');

// If modifying these scopes, delete your previously saved credentials
// at ~/.credentials/tasks-nodejs-quickstart.json
var SCOPES = ['https://www.googleapis.com/auth/tasks'];
var TOKEN_DIR = (process.env.HOME || process.env.HOMEPATH ||
    process.env.USERPROFILE) + '/.credentials/';
var TOKEN_PATH = TOKEN_DIR + 'tasks-nodejs-quickstart.json';

//console.log('%o', process.argv);

var callArgs = {};

// Load client secrets from a local file.
fs.readFile('client_secret.json', function processClientSecrets(err, content)
{
    if (err)
    {
        console.log('Error loading client secret file: ' + err);
        return;
    }
    // Authorize a client with the loaded credentials, then call the
    // Google Tasks API.

    var cIndex = process.argv.indexOf('-c');
    var hIndex = process.argv.indexOf('-h');

    if (hIndex >= 1)
    {
        console.log(process.argv[0]);
        console.log(
            '\t-c [listtasklists,listtasks id,createTask id task_text]');
        console.log('\te.g.');
        console.log('\t\t-c listtasklists');
        console.log(
            '\t\t-c listtasks MDgxNjI2ODQ0MzE4Mjk5ODUzMzg6NTQzODEwODc2OjA');
        console.log(
            '\t\t-c createtask MDgxNjI2ODQ0MzE4Mjk5ODUzMzg6NTQzODEwODc2OjA \'My new special task\' [-d today|-d tomorrow]');
    }
    else
    {
        var command = process.argv[cIndex + 1];
        switch (command)
        {
            case 'listtasklists':
                authorize(JSON.parse(content), listtasklists);
                break;
            case 'listtasks':
                callArgs.id = process.argv[cIndex + 2];
                authorize(JSON.parse(content), listtasks);
                break;
            case 'createtask':
                callArgs.id = process.argv[cIndex + 2];
                callArgs.task = {title: process.argv[cIndex + 3]};
                authorize(JSON.parse(content), createTask);
                break;
        }
    }
});

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 *
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
function authorize(credentials, callback)
{
//    console.log('%o', credentials)
    var clientSecret = credentials.installed.client_secret;
    var clientId = credentials.installed.client_id;
    var redirectUrl = credentials.installed.redirect_uris[0];
    var auth = new googleAuth();
    var oauth2Client = new auth.OAuth2(clientId, clientSecret, redirectUrl);

    // Check if we have previously stored a token.
    fs.readFile(TOKEN_PATH, function (err, token)
    {
        if (err)
        {
            getNewToken(oauth2Client, callback);
        }
        else
        {
            oauth2Client.credentials = JSON.parse(token);
            callback(oauth2Client);
        }
    });
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 *
 * @param {google.auth.OAuth2} oauth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback to call with the authorized
 *     client.
 */
function getNewToken(oauth2Client, callback)
{
    var authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES
    });
    console.log('Authorize this app by visiting this url: ', authUrl);
    var rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    rl.question('Enter the code from that page here: ', function (code)
    {
        rl.close();
        oauth2Client.getToken(code, function (err, token)
        {
            if (err)
            {
                console.log('Error while trying to retrieve access token', err);
                return;
            }
            oauth2Client.credentials = token;
            storeToken(token);
            callback(oauth2Client);
        });
    });
}

/**
 * Store token to disk be used in later program executions.
 *
 * @param {Object} token The token to store to disk.
 */
function storeToken(token)
{
    try
    {
        fs.mkdirSync(TOKEN_DIR);
    }
    catch (err)
    {
        if (err.code != 'EEXIST')
        {
            throw err;
        }
    }
    fs.writeFile(TOKEN_PATH, JSON.stringify(token));
    console.log('Token stored to ' + TOKEN_PATH);
}

function createTask(auth)
{
    var service = google.tasks('v1');
    var dIndex = process.argv.indexOf('-d');
    var gtArgs = {
        tasklist: callArgs.id,
        auth: auth,
        resource: callArgs.task
    };

    if (dIndex != -1)
    {
        var dueString = process.argv[dIndex + 1];
        var date = new Date();
        date.setHours(0, 0, 0, 0);
        switch (dueString)
        {
            case 'today':
                gtArgs.resource.due = date.toISOString();
                break;
            case 'tomorrow':
                gtArgs.resource.due = new Date(date.getTime() +
                    1000 * 60 * 60 * 24).toISOString();
                break;
        }
    }
    console.log('callArgs: %o', callArgs);
    service.tasks.insert(gtArgs, function (err, response)
    {
        if (err)
        {
            console.log('The API returned an error: ' + err);
            return;
        }
        console.log('return: %o ', response);
    });
}

function listtasks(auth)
{
    var service = google.tasks('v1');
    service.tasks.list({
        tasklist: callArgs.id,
        auth: auth
    }, function (err, response)
    {
        if (err)
        {
            console.log('The API returned an error: ' + err);
            return;
        }
        var items = response.items;
        if (items.length == 0)
        {
            console.log('No task lists found.');
        }
        else
        {
            console.log('Task lists:');
            var parentStack = new Array();
            for (var i = 0; i < items.length; i++)
            {
                var item = items[i];
                /*                if (item.parent !== undefined)
                 {   // we have a parent
                 if (parentStack[parentStack.length] == item.parent)
                 {   // same parent as last time
                 }
                 else
                 {

                 }
                 }
                 else
                 {   // no parent, it's a root task.
                 parentStack = new Array();
                 }*/
                //console.log(item);
                if (item.status == 'completed')
                {   // item completed, show green.
                    console.log(chalk.grey(' * ' + item.title));
                }
                else if (Date.parse(item.due) < Date.now())
                {   // item due today, show red.
                    console.log(chalk.yellow(' * ' + item.title));
                }
                else if (Date.parse(item.due + 1000*60*60*24) < Date.now())
                {   // item overdue, show red.
                    console.log(chalk.red(' * ' + item.title));
                }
                else
                {
                    console.log(' * ', item.title)
                }
            }
        }
    });

}

/**
 * Lists the user's first 10 task lists.
 *
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 */
function listtasklists(auth)
{
    var service = google.tasks('v1');
    service.tasklists.list({
        auth: auth,
    }, function (err, response)
    {
        if (err)
        {
            console.log('The API returned an error: ' + err);
            return;
        }
        var items = response.items;
        if (items.length == 0)
        {
            console.log('No task lists found.');
        }
        else
        {
            console.log('Task lists:');
            for (var i = 0; i < items.length; i++)
            {
                var item = items[i];
                console.log('%s (%s)', item.title, item.id);
            }
        }
    });
}
