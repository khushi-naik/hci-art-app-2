# Healing Strokes

A collaborative art therapy platform built as a multiplayer, turn-based drawing experience for self-guided stress relief. Multiple users draw together in real time on a shared canvas, with state kept in sync across everyone connected.

## Features

- Real-time collaborative drawing canvas shared across concurrent users
- Turn-based multiplayer structure designed around self-guided stress relief
- Easy access to information about ongoing artistic workshops and therapists in the user's region

## Tech Stack

- **Backend:** Node.js, Express
- **Frontend:** EJS (server-rendered views)
- **Real-time communication:** Socket.io (WebSockets)

## Built On

The shared drawing canvas in this project is built on top of **[Doska](https://github.com/samutichev/Doska)**, an open-source online drawboard created by **Stepan Samutichev**.

On top of that foundation, this project adds:

- Turn-based multiplayer game mechanics designed for self-guided art therapy
- Real-time synchronization logic to support the turn-based flow across concurrent users

## Getting Started

### Prerequisites

- Node.js installed

### Installation

```bash
git clone https://github.com/khushi-naik/hci-art-app-2.git
cd hci-art-app-2
npm install
```

### Running Locally

```bash
npm start
```

This runs `node server.js`, matching the `start` script in `package.json`.


## Author

**Khushi Naik**
[LinkedIn](https://linkedin.com/in/khushinaik20) | [GitHub](https://github.com/khushi-naik)
