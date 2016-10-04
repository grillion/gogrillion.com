module.exports = function(grunt) {
  'use strict';

  grunt.initConfig({

    copy: {
      bootstrapFonts: {
        expand: true,
        cwd: "public/plugin/bootstrap/fonts/",
        src: "*",
        dest: "public/fonts/"
      }
    },

    //Development HTTP Server, HTTP Proxy, and live reload
    connect: {
      dev: {
        options: {
          debug: true,
          keepalive: true,
          open: true,
          base: {
            path: 'public/',
            options: {
              index: 'index.html'
            }
          },
          port: 8080
        }
      }
    },

    less: {
      gui: {
        files: {
          'public/css/app.css': 'public/less/app.less'
        }
      }
    }
  });

  grunt.loadNpmTasks('grunt-contrib-connect');
  grunt.loadNpmTasks('grunt-contrib-copy');
  grunt.loadNpmTasks('grunt-contrib-less');
  grunt.loadTasks('tasks');

  grunt.registerTask('dev', [
    'copy:bootstrapFonts',
    'less',
    'connect:dev'
  ]);
};