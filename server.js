const path = require("path");
const express = require("express");
const http = require("http");
const socketio = require("socket.io");
const PORT = process.env.PORT || 3000;

const app = express();
const server = http.createServer(app);

const io = socketio(server);

app.use(express.static(path.join(__dirname, "public")));

let rooms = {};
let socketroom = {};
let socketname = {};
let micsocket = {};
let videosocket = {};
io.on("connect", (socket) => {
    socket.on("join room", (roomid, username) => {
        socket.join(roomid);
        socketroom[socket.id] = roomid;
        socketname[socket.id] = username;
        micsocket[socket.id] = "on";
        videosocket[socket.id] = "on";

        if (rooms[roomid] && rooms[roomid].length > 0) {
            rooms[roomid].push(socket.id);
            socket.to(roomid).emit("message", `${username} joined the room.`);
            io.to(socket.id).emit(
                "join room",
                rooms[roomid].filter((pid) => pid !== socket.id),
                socketname,
                micsocket,
                videosocket
            );
        } else {
            rooms[roomid] = [socket.id];
            io.to(socket.id).emit("join room", null, null, null, null);
        }
        io.to(roomid).emit("user count", rooms[roomid].length);
    });

    socket.on("video-offer", (offer, sid) => {
        socket
            .to(sid)
            .emit(
                "video-offer",
                offer,
                socket.id,
                socketname[socket.id],
                micsocket[socket.id],
                videosocket[socket.id]
            );
    });

    socket.on("video-answer", (answer, sid) => {
        socket.to(sid).emit("video-answer", answer, socket.id);
    });

    socket.on("new icecandidate", (candidate, sid) => {
        socket.to(sid).emit("new icecandidate", candidate, socket.id);
    });

    // socket.on("disconnect", () => {
    //     if (!socketroom[socket.id]) return;
    //     socket
    //         .to(socketroom[socket.id])
    //         .emit(
    //             "message",
    //             `${socketname[socket.id]} left the chat.`,
    //             `Bot`,
    //             moment().format("h:mm a")
    //         );
    //     socket.to(socketroom[socket.id]).emit("remove peer", socket.id);
    //     var index = rooms[socketroom[socket.id]].indexOf(socket.id);
    //     rooms[socketroom[socket.id]].splice(index, 1);
    //     io.to(socketroom[socket.id]).emit(
    //         "user count",
    //         rooms[socketroom[socket.id]].length
    //     );
    //     delete socketroom[socket.id];
    //     console.log("--------------------");
    //     console.log(rooms[socketroom[socket.id]]);
    // });
});

server.listen(PORT, () =>
    console.log(`Server is up and running on port ${PORT}`)
);
