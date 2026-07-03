/** Snow Country brand theme — matches logo (red #E60000 on black) */
if (typeof tailwind !== 'undefined') {
  tailwind.config = {
    theme: {
      extend: {
        colors: {
          brand: {
            50: '#fff0f0',
            100: '#ffe0e0',
            200: '#ffb8b8',
            300: '#ff8080',
            400: '#ff3333',
            500: '#e60000',
            600: '#cc0000',
            700: '#a80000',
            800: '#850000',
            900: '#5c0000',
          },
          ink: {
            50: '#f7f7f7',
            100: '#ececec',
            200: '#d4d4d4',
            300: '#a3a3a3',
            400: '#737373',
            500: '#525252',
            600: '#404040',
            700: '#262626',
            800: '#141414',
            900: '#000000',
          },
        },
      },
    },
  };
}
