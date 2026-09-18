const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const routes = require('./routes');
const { errorHandler } = require('./middleware/errorHandler');

const app = express();
app.use(helmet());
app.use(express.json({ limit: '1mb' }));
const origins = (process.env.CORS_ORIGIN || '').split(',').map((s) => s.trim()).filter(Boolean);
app.use(cors({ origin: origins.length ? origins : true, credentials: true }));
app.use(morgan('combined'));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 500 }));
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));

const prefix = process.env.API_PREFIX || '/api';
app.use(prefix, routes);
app.get('/', (req, res) => res.json({ name: 'PARKO API', health: `${prefix}/health` }));
app.use(errorHandler);
module.exports = app;
