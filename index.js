// Test URL:
// /downloadSong?q=00NJC5H7lMteO234u8BvcN
const express = require("express");
const fetch = require("node-fetch");
const ytdl = require("ytdl-core");
const search = require("ytsr");
const ffmpeg = require("fluent-ffmpeg");
const fs = require("fs");
require("dotenv").config();

var data = {
  artist: "Me",
};
try {
  fs.unlinkSync("output.mp3");
} catch (e) {}

ffmpeg("temp.mp3")
  .outputOptions("-c:a libmp3lame")
  .outputOptions("-metadata", 'title="song x"')
  .save("output.mp3")
  .on("start", function (cmdline) {
    console.log("Command line: " + cmdline);
  })
  .on("end", () => {
    console.log("Ended");
  });

var SpotifyWebApi = require("spotify-web-api-node");
var api = new SpotifyWebApi({
  clientId: process.env.ID,
  clientSecret: process.env.SECRET,
  //   I don't think this is needed
  redirectUri: "http://www.example.com/callback",
});

const app = express();
app.set("json spaces", 2);

refreshToken().then((token) => {
  api.setAccessToken(token);
});

app.get("/playlists", query, async (req, res) => {
  var results = await api.searchPlaylists(req.query.q);
  res.json(results);
});
app.get("/playlist", query, async (req, res) => {
  var results = await api.getPlaylistTracks(req.query.q);
  res.json(results);
});
app.get("/song", query, async (req, res) => {
  var results = await api.getTrack(req.query.q);
  res.json(results);
});
app.get("/downloadSong", async (req, res) => {
  var song = await api.getTrack(req.query.q);
  song = song.body;
  var searchQuery = `${song.name} ${song.artists[0].name} ${song.album.name} ${
    song.album.release_date.split("-")[0]
  }`;
  var search_res = await search(searchQuery);
  var url = search_res.items[0].url;
  console.log("\n\n\n");
  console.log("Downloading url: ", url);
  res.writeHead(200, {
    // I used to use application/octet-stream
    "Content-Type": "audio/mp3",
    "Content-Disposition": `attachment; filename=${song.name}.mp3`,
  });
  var stream = ytdl(url, { quality: "highestaudio", format: "mp3" });
  stream.pipe(fs.createWriteStream("temp.mp3"));
  await new Promise((resPromise) => {
    stream.on("data", () => {
      console.log("Got stream data");
    });
    stream.on("end", () => {
      console.log("Stream ended");
      //   Wait for stream to end
      resPromise();
    });
  });
  console.log("Promise finished");
  var data = {
    artist: "Me",
  };
  console.log("waiting 2 seconds in case it fixes stuff");
  await new Promise((resolve) => setTimeout(resolve, 2000));
  console.log("2 seconds passed");
  meta.write("temp.mp3", data, function (err, data) {
    if (err) console.error("Error writing metadata", err);
    else console.log(data);
  });

  res.end();
});

app.listen(3000, () => {
  console.log("server started");
});

async function refreshToken() {
  var params =
    "?" +
    encode({
      q: "test",
      grant_type: "refresh_token",
      refresh_token: process.env.REFRESH_TOKEN,
      client_secret: process.env.SECRET,
      client_id: process.env.ID,
    });

  var r = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    body: params,
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
  }).then((res) => res.json());
  console.log(Object.keys(r));
  TOKEN = r.access_token;
  return r.access_token;
}
function encode(obj) {
  var str = [];
  for (var p in obj)
    if (obj.hasOwnProperty(p)) {
      str.push(encodeURIComponent(p) + "=" + encodeURIComponent(obj[p]));
    }
  return str.join("&");
}
function query(req, res, next) {
  if (!req.query.q) {
    return res.json({ error: true, message: "No query parameter provided." });
  }
  next();
}
function toBuffer(stream) {
  return new Promise((resolve, reject) => {
    const _buf = [];

    stream.on("data", (chunk) => _buf.push(chunk));
    stream.on("end", () => resolve(Buffer.concat(_buf)));
    stream.on("error", (err) => reject(err));
  });
}
