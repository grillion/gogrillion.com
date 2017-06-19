module.exports = function(grunt) {
  'use strict';

  grunt.initConfig({

    //Development HTTP Server, HTTP Proxy, and live reload
    connect: {
      dev: {
        options: {
          debug: true,
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
    },

    watch:{
      dev:{
        files: [ 'public/less/**/*' ],
        tasks: [ 'less' ],
        options: {
          livereload: true
        }
      }
    }


  });

  grunt.loadNpmTasks('grunt-contrib-connect');
  grunt.loadNpmTasks('grunt-contrib-copy');
  grunt.loadNpmTasks('grunt-contrib-less');
  grunt.loadNpmTasks('grunt-contrib-watch');

  grunt.registerTask('dev', [
    'less',
    'connect:dev',
    'watch:dev'
  ]);

  grunt.registerTask('compile', [
    'less'
  ])
};