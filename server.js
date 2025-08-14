// Mini WMS backend - deploy-ready (in-memory demo)
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// In-memory storage
let lots = [];
let history = [];

const uid = () => Math.random().toString(36).slice(2,9);
const todayYYYYMMDD = () => new Date().toISOString().slice(0,10);
function offsetDate(days){ const d=new Date(); d.setDate(d.getDate()+days); return d.toISOString().slice(0,10); }

function seed(){
  const now = new Date();
  lots = [
    { id: uid(), sku: 'SKU-1001', name: 'Carton Box M', qty: 120, batch: 'B01', expiry: null, location: 'A1-01', received_at: new Date(now - 50*86400000).toISOString() },
    { id: uid(), sku: 'SKU-1002', name: 'Bubble Wrap Roll', qty: 18, batch: 'B02', expiry: null, location: 'BULK-01', received_at: new Date(now - 20*86400000).toISOString() },
    { id: uid(), sku: 'SKU-2001', name: 'USB Charger 20W', qty: 5, batch: 'L1', expiry: offsetDate(30), location: 'PICK-01', received_at: new Date(now - 40*86400000).toISOString() },
    { id: uid(), sku: 'SKU-2001', name: 'USB Charger 20W', qty: 8, batch: 'L2', expiry: offsetDate(10), location: 'BULK-01', received_at: new Date(now - 10*86400000).toISOString() }
  ];
  history = [];
}
seed();

function isExpired(expiry){
  if(!expiry) return false;
  return expiry < todayYYYYMMDD();
}

// GET stock lots
app.get('/api/stock', (_req, res) => {
  const data = lots.map(l => ({ ...l, status: isExpired(l.expiry) ? 'EXPIRED' : 'OK' }));
  res.json(data);
});

// GET summary
app.get('/api/summary', (_req, res) => {
  const m = {};
  for(const l of lots){
    if(!m[l.sku]) m[l.sku] = { sku: l.sku, name: l.name, qty:0, lots:0, soonest_expiry: null };
    m[l.sku].qty += l.qty;
    m[l.sku].lots += 1;
    if(l.expiry){
      if(!m[l.sku].soonest_expiry || l.expiry < m[l.sku].soonest_expiry) m[l.sku].soonest_expiry = l.expiry;
    }
  }
  res.json(Object.values(m));
});

// GET history
app.get('/api/history', (_req, res) => res.json(history));

// POST inbound
app.post('/api/inbound', (req, res) => {
  const { sku, name, qty, batch=null, expiry=null, location='DEFAULT' } = req.body || {};
  if(!sku || !name || !Number(qty)) return res.status(400).json({ error: 'Required: sku, name, qty' });
  const lot = { id: uid(), sku, name, qty: Number(qty), batch, expiry: expiry || null, location, received_at: new Date().toISOString() };
  lots.push(lot);
  history.push({ type: 'IN', sku, qty: Number(qty), details:{ batch, expiry, location }, ts: new Date().toISOString() });
  res.json({ message:'Received', lot });
});

// POST outbound (mode FEFO or FIFO)
app.post('/api/outbound', (req, res) => {
  const { sku, qty, mode='FEFO', minDaysToExpiry } = req.body || {};
  if(!sku || !Number(qty)) return res.status(400).json({ error:'Required: sku, qty' });
  const needed = Number(qty);
  const today = new Date();
  let candidate = lots.filter(l => l.sku === sku && l.qty > 0 && !isExpired(l.expiry));
  if(typeof minDaysToExpiry === 'number'){
    candidate = candidate.filter(l => {
      if(!l.expiry) return true;
      const d = new Date(l.expiry);
      const diffDays = Math.floor((d - today)/86400000);
      return diffDays >= minDaysToExpiry;
    });
  }
  if(mode === 'FIFO'){
    candidate.sort((a,b) => new Date(a.received_at) - new Date(b.received_at));
  } else {
    candidate.sort((a,b) => {
      if(!a.expiry && !b.expiry) return new Date(a.received_at) - new Date(b.received_at);
      if(!a.expiry) return 1;
      if(!b.expiry) return -1;
      if(a.expiry !== b.expiry) return new Date(a.expiry) - new Date(b.expiry);
      return new Date(a.received_at) - new Date(b.received_at);
    });
  }
  let remaining = needed;
  const picks = [];
  for(const lot of candidate){
    if(remaining <= 0) break;
    const take = Math.min(lot.qty, remaining);
    if(take > 0){
      picks.push({ lotId: lot.id, batch: lot.batch, location: lot.location, expiry: lot.expiry, qty: take });
      lot.qty -= take;
      remaining -= take;
    }
  }
  if(remaining > 0){
    return res.status(409).json({ error:'Insufficient quantity', requested: needed, allocated: needed-remaining, picks });
  }
  history.push({ type:'OUT', sku, qty: needed, details:{ mode, picks }, ts: new Date().toISOString() });
  res.json({ message:'Picked', sku, qty: needed, picks });
});

// DELETE lot
app.delete('/api/stock/:id', (req, res) => {
  const id = req.params.id;
  const idx = lots.findIndex(l => l.id === id);
  if(idx === -1) return res.status(404).json({ error:'Lot not found' });
  const removed = lots.splice(idx,1)[0];
  history.push({ type:'ADJ', sku: removed.sku, qty: -removed.qty, details:{ removedLot: id }, ts: new Date().toISOString() });
  res.json({ message:'Lot removed', removed });
});

app.post('/api/reset', (_req, res) => { seed(); res.json({ message:'Reset done', lots }); });

app.get('/', (_req,res) => res.sendFile(path.join(__dirname,'public','index.html')));

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
