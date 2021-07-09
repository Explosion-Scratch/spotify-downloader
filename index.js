// Test URL:
// /downloadSong?q=00NJC5H7lMteO234u8BvcN
const express = require("express");
const fetch = require("node-fetch");
const ytdl = require("ytdl-core");
const search = require("ytsr");
const ffmpeg = require("fluent-ffmpeg");
const fs = require("fs");
require("dotenv").config();

del();

function del() {
  try {
    fs.unlinkSync("audio_out.mp3");
    fs.unlinkSync("output.mp3");
    fs.unlinkSync("cover.png");
    fs.unlinkSync("cover.mp3");
    fs.unlinkSync("temp.mp3");
  } catch (e) {}
}

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
  try {
    fs.unlinkSync("temp.mp3");
    fs.unlinkSync("output.mp3");
  } catch (e) {}
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
  await new Promise((resolve) => {
    ffmpeg("temp.mp3")
      .outputOptions("-c:a libmp3lame")
      .outputOptions(
        "-metadata",
        `title=${JSON.stringify(song.name).replace(/^"/, "").replace(/"$/, "")}`
      )
      .outputOptions(
        "-metadata",
        `artist=${JSON.stringify(song.artists[0].name)
          .replace(/^"/, "")
          .replace(/"$/, "")}`
      )
      .outputOptions(
        "-metadata",
        `album=${JSON.stringify(song.album.name)
          .replace(/^"/, "")
          .replace(/"$/, "")}`
      )
      .outputOptions(
        "-metadata",
        `year=${JSON.stringify(song.album.release_date.split("-")[0])
          .replace(/^"/, "")
          .replace(/"$/, "")}`
      )
      .outputOptions(
        "-metadata",
        `date=${JSON.stringify(song.album.release_date.split("-")[0])
          .replace(/^"/, "")
          .replace(/"$/, "")}`
      )
      .outputOptions(
        "-metadata",
        `track=${JSON.stringify(song.track_number)
          .replace(/^"/, "")
          .replace(/"$/, "")}`
      )
      .save("output.mp3")
      .on("start", function (cmdline) {
        console.log("Command line: " + cmdline);
      })
      .on("end", () => {
        console.log("Ended");
        resolve();
      });
  });
  //   ffmpeg -i audio-in.mp3 -i picture.png -c:a copy -c:v copy -map 0:0 -map 1:0 -id3v2_version 3
  // -metadata:s:v title="Album cover" -metadata:s:v comment="Cover (front)" audio-out.mp3
  console.log("Downloading cover");
  var r = await new Promise((resolve) =>
    download(song.album.images[0].url, `${__dirname}/cover.png`, resolve)
  );
  console.log("Downloaded cover: ", r);

  const command = `-i output.mp3 -i cover.png -c:a copy -c:v copy -map 0:0 -map 1:0 -id3v2_version 3 -metadata:s:v title="Album cover" -metadata:s:v comment="Cover (front)" audio_out.mp3`;
  const run = require("./runCommand.js");
  run(
    "ffmpeg",
    command,
    (data) => console.log(data),
    () => {
      console.log("finished");
      res.end(fs.readFileSync("audio_out.mp3"));
      del();
    }
  );
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
const http = require("http");

function download(url, dest, cb) {
  url = url.replace("https", "http");
  const file = fs.createWriteStream(dest);

  const request = http.get(url, (response) => {
    // check if response is success
    if (response.statusCode !== 200) {
      return cb("Response status was " + response.statusCode);
    }

    response.pipe(file);
  });

  // close() is async, call cb after close completes
  file.on("finish", () => file.close(cb));

  // check for request error too
  request.on("error", (err) => {
    fs.unlink(dest);
    return cb(err.message);
  });

  file.on("error", (err) => {
    // Handle errors
    fs.unlink(dest); // Delete the file async. (But we don't check the result)
    return cb(err.message);
  });
}
