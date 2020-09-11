// Copyright (c)2020 Quinn Michaels

'use strict'

const {EventEmitter} = require('events');
class Svarga {
  constructor(opts) {
    opts = opts || {};

    opts.id = opts.id || this.uid();
    opts.config = opts.config || {};
    opts.me = opts.me || {};
    opts.vars = opts.vars || {};
    opts.events = opts.events || new EventEmitter({});
    opts.listeners = opts.listeners || {};
    opts.deva = opts.deva || {};
    opts.methods = opts.methods || {};
    opts.modules = opts.modules || {};
    opts.func = opts.func || {};
    opts.lib = opts.lib || {};
    opts.running = false;

    for (var opt in opts) {
      if (!this[opt]) this[opt] = opts[opt];
    }

    this.inherit = ["events", "config", "lib"];
    this.bind = ["listeners", "methods", "func", "lib", "me"];
  }

  // assign inherit function that maps a agent inherit module into the child agent
  assignInherit() {
    for (let d in this.deva) {
      this.inherit.forEach(inherit => {
        this.deva[d][inherit] = this[inherit];
      });
    }
    return Promise.resolve();
  }

  // assign bind function binds the local functions to "this" scope.
  assignBind() {
    this.bind.forEach(bind => {
      for (let x in this[bind]) {
        if (typeof this[bind][x] === 'function') this[bind][x] = this[bind][x].bind(this);
      }
    });
    this.me.parse = this.me.parse.bind(this);
    return Promise.resolve();
  }

  assignListeners() {

    this.events.on(`${this.me.key}:question`, packet => {
      return this.question(packet);
    }).on(`${this.me.key}:start`, () => {
      return this.start();
    }).on(`${this.me.key}:stop`, () => {
      return this.stop();
    }).on(`${this.me.key}:status`, () => {
      return this.status();
    }).on('loaded', () => {
      if (this.onLoaded) this.onLoaded.call(this);
    }).on('logout', () => {
      if (this.onLogout) this.onLogout.call(this);
      if (!this.running) return false;
      this.stop();
    });

    for (let x in this.listeners) {
      this.events.on(x, packet => {
        return this.listeners[x](packet);
      })
    }
    return Promise.resolve();
  }

  uid() {
    const min = Math.floor(Date.now() - (Date.now() / Math.PI));
    const max = Math.floor(Date.now() + (Date.now() * Math.PI));
    return Math.floor(Math.random() * (max - min)) + min;
  }

  talk(evt, resource=false) {
    return this.events.emit(evt, resource);
  }

  listen(evt, callback) {
    return this.events.on(evt, callback);
  }

  once(evt, callback) {
    return this.events.once(evt, callback);
  }

  ignore(evt, callback) {
    return this.events.removeListener(evt, callback);
  }

  addDeva(agent, opts) {
    this.deva[agent] = opts;
    return Promise.resolve();
  }

  deleteDeva(agent) {
    delete this.deva[agent];
    return Promise.resolve();
  }

  _notRunning(packet) {
    packet.answered = Date.now();
    packet.a = {
      bot: this.me,
      text: `${this.me.name} is OFFLINE`,
      data: {
        key: this.me.key,
        format: 'OFFLINE',
        result: false,
        error: false,
      }
    }
    this.talk(`${this.me.key}:question:${packet.id}`, packet);
  }

  _methodNotFound(packet) {
    packet.answered = Date.now();
    packet.a = {
      bot: this.me,
      text: `${this.me.key} ${packet.q.params[0]} is not a valid method`,
      data: {
        key: this.me.key,
        format: packet.q.params[0],
        result: false,
        error: false,
      }
    }
    this.talk(`${this.me.key}:question:${packet.id}`, packet);
  }

  question(packet) {
    const {name, key} = this.me;
    const repReg = new RegExp(`^#${key} `, 'gi');
    packet.q.text_orig = packet.q.text;
    packet.q.text = packet.q.text.replace(repReg, '').replace(/(^|\s)(:id:)(\s|$)/g, `$1#${packet.id}$3`);

    const q = packet.q.text.split(' ');
    packet.q.params = q[0].split(':');
    packet.q.text = q.slice(1).join(' ').trim();
    packet.asked = Date.now();

    const method = packet.q.params[0];

    if (!this.methods[method]) return setImmediate(() => {
      this._methodNotFound(packet);
    });

    if (!this.running && method !== 'start') return setImmediate(() => {
      this._notRunning(packet);
    });

    this.methods[method](packet).then(result => {
      packet.answered = Date.now();
      packet.a = {
        bot: this.me,
        text: result.text || `#${key} ${method}`,
        data: {
          format: key,
          type: method,
          result,
          error: false,
        },
      };
      this.talk(`${key}:question:${packet.id}`, packet);
    }).catch(err => {
      packet.answered = Date.now();
      packet.a = {
        bot: this.me,
        text: `#${key} ${method}`,
        data: {
          format: key,
          type: method,
          result: false,
          error: err,
        },
      };
      this.talk(`${key}:question:${packet.id}`, packet);
      this.talk('error', {type: `#${key}:question`, packet, err})
    });
  }

  status() {
    const id = this.uid();
    const text = `${this.me.key} ${this.running ? 'RUNNING' : 'STOPPED'}`
    this.talk(`status`, {
      id,
      text,
      data:{
        key: this.me.key,
        text: this.running,
      },
      created: Date.now(),
    });
    return Promise.resolve(this.running);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.status();
    if (this.onStart) return this.onStart.call(this);
  }

  stop() {
    if (!this.running) return;
    this.running = false;
    this.status();
    if (this.onStop) return this.onStop.call(this);
  }

  init(deva=false) {
    this.events.setMaxListeners(0);
    return this.assignInherit().then(() => {
      return this.assignBind();
    }).then(() => {
      return this.assignListeners();
    }).then(() => {
      if (deva) this.initDeva();
      if (this.onInit) return this.onInit.call(this);
    }).catch(err => {
      this.talk('error', {type: `#${this.me.key}:init`, err})
      return console.error(err);
    });
  }

  initDeva() {
    for (let x in this.deva) {
      this.deva[x].init();
    }
    return Promise.resolve();
  }

  // axios functions
  getUrl(url, packet) {
    return axios.get(url, packet)
  }

  postUrl(url, data) {
    return axios.post(url, data);
  }

  createUrl(config) {
    return axios.create(config)
  }

}
module.exports = Svarga;