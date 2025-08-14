const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json());

// Serve static UI
app.use(express.static(path.join(__dirname, 'public')));

// Simple items API using JSON file storage (demo)
const dataDir = path.join(__dirname, 'data');
const itemsFile = path.join(dataDir, 'items.json');

function readItems(){
  try{
    const raw = fs.readFileSync(itemsFile, 'utf8');
    return JSON.parse(raw || '[]');
  }catch(e){
    return [];
  }
}
function writeItems(items){
  fs.writeFileSync(itemsFile, JSON.stringify(items, null, 2));
}

// Ensure data directory & file exists
if(!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);
if(!fs.existsSync(itemsFile)) writeItems([]);

// GET all items
app.get('/api/items', (req, res) => {
  const items = readItems();
  res.json(items);
});

// POST create item
app.post('/api/items', (req, res) => {
  const items = readItems();
  const id = Date.now();
  const newItem = { id, ...req.body };
  items.push(newItem);
  writeItems(items);
  res.status(201).json(newItem);
});

// PUT update item
app.put('/api/items/:id', (req, res) => {
  let items = readItems();
  const id = Number(req.params.id);
  items = items.map(it => it.id === id ? { ...it, ...req.body } : it);
  writeItems(items);
  res.json({ message: 'Item updated' });
});

// DELETE item
app.delete('/api/items/:id', (req, res) => {
  let items = readItems();
  const id = Number(req.params.id);
  const before = items.length;
  items = items.filter(it => it.id !== id);
  writeItems(items);
  if(items.length === before) return res.status(404).json({ error: 'Item not found' });
  res.json({ message: 'Item deleted' });
});

// Fallback to frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
