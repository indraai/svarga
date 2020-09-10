const Svarga = require(@indra.ai/svarga)

const HelloWorld = new Svarga({
  me: {
    me: {
      key: 'hello',
      name: 'Hello World',
      description: 'The most over complex Hello World in the Universe',
      prompt: {
        emoji: '🐶',
        text: 'hello',
        color: 'white',
      },
      voice: {
        speech: 'Alex',
        speed: 1
      },
      profile: {
        avatar: '',
        background: '',
        describe: 'Hello World Deva',
        gender: 'N',
      },
      translate(input) {
        return input.trim();
      },
      parse(input) {
        return input.trim();
      }
    },
    vars: {
      hello: 'Hello World'
    },
    listeners: {},
    deva: {},
    modules: {},
    func: {
      hello() {
        return this.vars.hello;
      }
    },
    methods: {
      hello() {
        return this.func.hello();
      }
    },

    onStart() {},
    onStop() {},
    onLoaded() {},
    onLogout() {},
    onInit() {
      this.start();
      this.methods.hello();
    },
  }
});

HelloWorld.init();
