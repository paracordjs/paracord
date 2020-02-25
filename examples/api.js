/* Making a request with the Paracord client is the same as with the Api client. */

'use strict';

const { Api } = require('paracord');

const token = 'myBotToken'; // https://discordapp.com/developers/applications/
const api = new Api(token);

const method = 'GET';
const endpoint = '/channels/123456789'; // https://discordapp.com/developers/docs/resources/channel

/* With promise chain. */
api.request(method, endpoint).then((res) => {
  if (res.status === 200) {
    console.log(res.data);
  } else {
    throw Error('Bad response.');
  }
});

/* With async/await. */
async function main() {
  const res = await api.request(method, endpoint);
  if (res.status === 200) {
    console.log(res.data);
  } else {
    throw Error('Bad response.');
  }
}
main();
