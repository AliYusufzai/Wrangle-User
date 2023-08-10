const socket = io();
const myvideo = document.querySelector("#vd1");
const roomid = params.get("room");
let username;

const videoContainer = document.querySelector("#vcont");
const overlayContainer = document.querySelector("#overlay");
const continueButt = document.querySelector(".continue-name");
const nameField = document.querySelector("#name-field");

let videoAllowed = 1;
let audioAllowed = 1;

let micInfo = {};
let videoInfo = {};

let videoTrackReceived = {};

const configuration = { iceServers: [{ urls: "stun:stun.stunprotocol.org" }] };

const mediaConstraints = { video: true, audio: true };

let connections = {};
let cName = {};
let audioTrackSent = {};
let videoTrackSent = {};

let mystream;

continueButt.addEventListener("click", () => {
    if (nameField.value == "") return;
    username = nameField.value;
    overlayContainer.style.visibility = "hidden";
    socket.emit("join room", roomid, username);
});

nameField.addEventListener("keyup", function (event) {
    if (event.keyCode === 13) {
        event.preventDefault();
        continueButt.click();
    }
});

socket.on("user count", (count) => {
    if (count > 1) {
        videoContainer.className = "video-cont";
    } else {
        videoContainer.className = "video-cont-single";
    }
});

let peerConnection;

function handleGetUserMediaError(e) {
    switch (e.name) {
        case "NotFoundError":
            alert(
                "Unable to open your call because no camera and/or microphone" +
                    "were found."
            );
            break;
        case "SecurityError":
        case "PermissionDeniedError":
            break;
        default:
            alert("Error opening your camera and/or microphone: " + e.message);
            break;
    }
}

function reportError(e) {
    console.log(e);
    return;
}

function startCall() {
    navigator.mediaDevices
        .getUserMedia(mediaConstraints)
        .then((localStream) => {
            myvideo.srcObject = localStream;
            myvideo.muted = true;

            localStream.getTracks().forEach((track) => {
                for (let key in connections) {
                    connections[key].addTrack(track, localStream);
                    if (track.kind === "audio") audioTrackSent[key] = track;
                    else videoTrackSent[key] = track;
                }
            });
        })
        .catch(handleGetUserMediaError);
}

function handleVideoOffer(offer, sid, cname, micinf, vidinf) {
    cName[sid] = cname;
    console.log("video offered recevied");
    micInfo[sid] = micinf;
    videoInfo[sid] = vidinf;
    connections[sid] = new RTCPeerConnection(configuration);

    connections[sid].onicecandidate = function (event) {
        if (event.candidate) {
            console.log("icecandidate fired");
            socket.emit("new icecandidate", event.candidate, sid);
        }
    };

    connections[sid].ontrack = function (event) {
        if (!document.getElementById(sid)) {
            console.log("track event fired");
            let vidCont = document.createElement("div");
            let newvideo = document.createElement("video");
            let name = document.createElement("div");
            let muteIcon = document.createElement("div");
            let videoOff = document.createElement("div");
            videoOff.classList.add("video-off");
            muteIcon.classList.add("mute-icon");
            name.classList.add("nametag");
            name.innerHTML = `${cName[sid]}`;
            vidCont.id = sid;
            muteIcon.id = `mute${sid}`;
            videoOff.id = `vidoff${sid}`;
            muteIcon.innerHTML = `<i class="fas fa-microphone-slash"></i>`;
            videoOff.innerHTML = "Video Off";
            vidCont.classList.add("video-box");
            newvideo.classList.add("video-frame");
            newvideo.autoplay = true;
            newvideo.playsinline = true;
            newvideo.id = `video${sid}`;
            newvideo.srcObject = event.streams[0];

            if (micInfo[sid] == "on") muteIcon.style.visibility = "hidden";
            else muteIcon.style.visibility = "visible";

            if (videoInfo[sid] == "on") videoOff.style.visibility = "hidden";
            else videoOff.style.visibility = "visible";

            vidCont.appendChild(newvideo);
            vidCont.appendChild(name);
            vidCont.appendChild(muteIcon);
            vidCont.appendChild(videoOff);

            videoContainer.appendChild(vidCont);
        }
    };

    connections[sid].onremovetrack = function (event) {
        if (document.getElementById(sid)) {
            document.getElementById(sid).remove();
            console.log("removed a track");
        }
    };

    connections[sid].onnegotiationneeded = function () {
        connections[sid]
            .createOffer()
            .then(function (offer) {
                return connections[sid].setLocalDescription(offer);
            })
            .then(function () {
                socket.emit(
                    "video-offer",
                    connections[sid].localDescription,
                    sid
                );
            })
            .catch(reportError);
    };

    let desc = new RTCSessionDescription(offer);

    connections[sid]
        .setRemoteDescription(desc)
        .then(() => {
            return navigator.mediaDevices.getUserMedia(mediaConstraints);
        })
        .then((localStream) => {
            localStream.getTracks().forEach((track) => {
                connections[sid].addTrack(track, localStream);
                console.log("added local stream to peer");
                if (track.kind === "audio") {
                    audioTrackSent[sid] = track;
                    if (!audioAllowed) audioTrackSent[sid].enabled = false;
                } else {
                    videoTrackSent[sid] = track;
                    if (!videoAllowed) videoTrackSent[sid].enabled = false;
                }
            });
        })
        .then(() => {
            return connections[sid].createAnswer();
        })
        .then((answer) => {
            return connections[sid].setLocalDescription(answer);
        })
        .then(() => {
            socket.emit("video-answer", connections[sid].localDescription, sid);
        })
        .catch(handleGetUserMediaError);
}

function handleNewIceCandidate(candidate, sid) {
    console.log("new candidate recieved");
    var newcandidate = new RTCIceCandidate(candidate);

    connections[sid].addIceCandidate(newcandidate).catch(reportError);
}

function handleVideoAnswer(answer, sid) {
    console.log("answered the offer");
    const ans = new RTCSessionDescription(answer);
    connections[sid].setRemoteDescription(ans);
}

//Socket.io-CLIENT code

socket.on("video-offer", handleVideoOffer);

socket.on("new icecandidate", handleNewIceCandidate);

socket.on("video-answer", handleVideoAnswer);

socket.on("join room", async (conc, cnames, micinfo, videoinfo) => {
    if (cnames) cName = cnames;

    if (micinfo) micInfo = micinfo;

    if (videoinfo) videoInfo = videoinfo;

    console.log(cName);
    if (conc) {
        await conc.forEach((sid) => {
            connections[sid] = new RTCPeerConnection(configuration);

            connections[sid].onicecandidate = function (event) {
                if (event.candidate) {
                    console.log("icecandidate fired");
                    socket.emit("new icecandidate", event.candidate, sid);
                }
            };

            connections[sid].ontrack = function (event) {
                if (!document.getElementById(sid)) {
                    console.log("track event fired");
                    let vidCont = document.createElement("div");
                    let newvideo = document.createElement("video");
                    let name = document.createElement("div");
                    let muteIcon = document.createElement("div");
                    let videoOff = document.createElement("div");
                    videoOff.classList.add("video-off");
                    muteIcon.classList.add("mute-icon");
                    name.classList.add("nametag");
                    name.innerHTML = `${cName[sid]}`;
                    vidCont.id = sid;
                    muteIcon.id = `mute${sid}`;
                    videoOff.id = `vidoff${sid}`;
                    muteIcon.innerHTML = `<i class="fas fa-microphone-slash"></i>`;
                    videoOff.innerHTML = "Video Off";
                    vidCont.classList.add("video-box");
                    newvideo.classList.add("video-frame");
                    newvideo.autoplay = true;
                    newvideo.playsinline = true;
                    newvideo.id = `video${sid}`;
                    newvideo.srcObject = event.streams[0];

                    if (micInfo[sid] == "on")
                        muteIcon.style.visibility = "hidden";
                    else muteIcon.style.visibility = "visible";

                    if (videoInfo[sid] == "on")
                        videoOff.style.visibility = "hidden";
                    else videoOff.style.visibility = "visible";

                    vidCont.appendChild(newvideo);
                    vidCont.appendChild(name);
                    vidCont.appendChild(muteIcon);
                    vidCont.appendChild(videoOff);

                    videoContainer.appendChild(vidCont);
                }
            };

            connections[sid].onremovetrack = function (event) {
                if (document.getElementById(sid)) {
                    document.getElementById(sid).remove();
                }
            };

            connections[sid].onnegotiationneeded = function () {
                connections[sid]
                    .createOffer()
                    .then(function (offer) {
                        return connections[sid].setLocalDescription(offer);
                    })
                    .then(function () {
                        socket.emit(
                            "video-offer",
                            connections[sid].localDescription,
                            sid
                        );
                    })
                    .catch(reportError);
            };
        });

        console.log("added all sockets to connections");
        startCall();
    } else {
        console.log("waiting for someone to join");
        navigator.mediaDevices
            .getUserMedia(mediaConstraints)
            .then((localStream) => {
                myvideo.srcObject = localStream;
                myvideo.muted = true;
                mystream = localStream;
            })
            .catch(handleGetUserMediaError);
    }
});

socket.on("remove peer", (sid) => {
    if (document.getElementById(sid)) {
        document.getElementById(sid).remove();
    }

    delete connections[sid];
});
