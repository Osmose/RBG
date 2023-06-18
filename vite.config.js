import path from 'path';

export default {
  base: '/gatekid-rpg/',
  resolve: {
    alias: {
      gate: path.resolve(__dirname, 'src'),
    },
  },
};
