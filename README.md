Mini WMS - Deploy-ready (simple demo)

Contents:
- server.js : Express backend serving API and static frontend
- package.json : dependencies and start script
- public/index.html : simple frontend placeholder
- data/items.json : simple JSON storage for items (demo only)

How to run locally:
1. npm install
2. npm start
3. Open http://localhost:10000

Deploy to Render:
- Push this repo to GitHub
- Create new Web Service on Render, connect repo
- Build: npm install, Start: npm start
