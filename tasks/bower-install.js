module.exports = function(grunt) {
  'use strict';

  // Imports
  var async = require('async'),
    bower = require('bower'),
    bowerConfig = grunt.file.readJSON('bower.json'),
    fs = require('fs'),
    fse = require('fs-extra'),
    fail = grunt.fail,
    glob = require('glob'),
    log = grunt.log,
    path = require('path'),
    q = require('q'),
    util = require('util'),
    _ = require('lodash');

  // Default bower-specific options
  var bowerOptions = {
    bowerDir: 'bower_components'
  };

  // Default task config
  var taskOptions = {
    copyToTarget: true,
    cleanBower: false,
    cleanTarget: true,
    bowerInstall: true,
    targetDir: 'public/plugin'
  };

  //***********************************************************
  // Private support functions
  //***********************************************************

  /**
   * Get a list of packages from the bower components dir,
   */
  function getPackageList() {
    var def = q.defer();
    var listCmd = bower.commands.list({paths: true});
    listCmd.on('end', function (data) {

      def.resolve(
        mergeOverrides(
          _.mapValues( data, function (n) { return _.isString(n) ? [n] : n; })
        )
      );

    });

    listCmd.on('error', function (err) {
      console.log(err);
      def.reject(err);
    });

    return def.promise;
  }

  /**
   * Get the list of files exported by a module. This will check the current project's
   * bower.json for an exportsOverride on the package. IF no override is found the package's
   * bower.json file will be check for a list of main files. If no main files are listed, the
   * package's entire folder will be selected.
   *
   * Each file or folder returned will be relative to the package's root.
   *
   * @return {Array<String>} An array of files or paths exported by this package
   */
  function mergeOverrides(pkgExports) {

    // Check for an 'exportsOverride' definition in bower.json, without one, no changes are made
    if (!_.get(bowerConfig, 'exportsOverride')) {
      return pkgExports;
    }

    _.each(_.get(bowerConfig, 'exportsOverride'), function (manualOverrides, packageName) {

      // An array of items
      if (_.isArray(manualOverrides)) {
        console.log('Found overrides (' + packageName.yellow + ') ' + util.inspect(manualOverrides));
        pkgExports[packageName] = _.map(manualOverrides, function (n) {
          return path.relative('.', path.resolve(bowerOptions.bowerDir, packageName, n));
        });

        // String is a single item
      } else if (_.isString(manualOverrides)) {
        console.log('Found override (' + packageName.yellow + ') ' + manualOverrides);
        pkgExports[packageName] = [path.relative('.', path.resolve(bowerOptions.bowerDir, packageName, manualOverrides))];

        // Null means skip this package
      } else if (_.isNull(manualOverrides)) {
        console.log('Found override (' + packageName.yellow + ') Remove package');
        delete pkgExports[packageName];
      } else {
        console.log('Found override (' + packageName.yellow + ') Bad format. Ignoring.');
      }

    });

    return pkgExports;
  }

  /**
   * Given a package name and single export line, generate the destination path or paths for wildcards
   * @param pkName
   * @param pkExport
   * @param targetDir
   */
  function getExportOperations(pkName, pkExport, targetDir) {

    var sourceStat;

    // Test for package folder, if so, add the wildcard for all all files
    if (path.resolve(pkExport) === path.resolve('.', bowerOptions.bowerDir, pkName)) {
      pkExport = path.relative('.', path.resolve('.', bowerOptions.bowerDir, pkName, '*'));
    }

    try {
      // This will fail if the path is a wildcard
      sourceStat = fs.statSync(pkExport);
    } catch (e) {
      console.log('  Possible Glob: ' + pkExport);
      // May not be a file, might be a wildcard
      return glob.sync(pkExport);
    }

    if (!sourceStat) {
      console.error('Bad export: ' + pkExport);
      return null;
    }

    return path.resolve(targetDir, pkName, path.basename(pkExport));
  }

  //***********************************************************
  // Task steps
  //***********************************************************

  function cleanDir(dir, cb) {
    console.log('Cleaning dir: ' + dir);
    fse.removeSync(dir);
    cb();
  }


  /**
   * Bower install step
   * @param options
   * @param cb
   */
  function runBowerInstall(options, cb) {
    console.log('Running bower install...');
    bower.commands.install([], options)
      .on('log', function (result) {
        log.writeln(['prepare-plugins', result.id.cyan, result.message].join(' '));
      })
      .on('error', function (code) {
        fail.fatal(code);
      })
      .on('end', function () {
        console.log('Bower install complete.');
        cb();
      });
  }

  /**
   * Copy packages to target dir step
   * @param targetDir
   * @param cb
   */
  function copyPackages(targetDir, cb) {
    console.log('Copying bower packages...');

    // Make target dir if needed
    fse.ensureDirSync(targetDir);

    //Get all packages to export with overrides merged
    getPackageList().then(function (packages) {

      //console.log('Packages: ', packages);

      // For each package, perform each copy operation
      _.each(packages, function (pkExports, packageName) {
        console.log(packageName.cyan + ' exports');

        _.each(pkExports, function (pkExport) {

          // An array of files to be copied or a string for single files
          var operations = getExportOperations(packageName, pkExport, targetDir);

          //IF there's any operation make sure the dest path exists
          if (operations) {
            fse.ensureDirSync(path.resolve(targetDir, packageName));
          }

          // Single file or dir?
          if (_.isString(operations)) {
            console.log('  ' + pkExport.green + ' -> ' + operations);

            fse.copySync(pkExport, operations);

            // An array of files or dirs
          } else if (_.isArray(operations)) {
            _.each(operations, function (o) {
              var subOp = getExportOperations(packageName, o, targetDir);
              console.log('  ' + o.green + ' -> ' + subOp);
              fse.copySync(o, subOp);
            });
          }

        });
      });

      console.log('Bower packages copied to target dir.');
      cb();
    });

  }


  /**
   * Main grunt task
   */
  grunt.registerTask('bower-plugins',
    'Run bower install and copy main files to targetDir.',
    function () {

      var options = taskOptions,
        tasks = [],
        done = this.async();

      if (options.cleanBower === true) {
        tasks.push(function (callback) {
          cleanDir(bowerOptions.bowerDir, callback);
        });
      }

      if (options.bowerInstall === true) {
        tasks.push(function (callback) {
          runBowerInstall(bowerOptions, callback);
        });
      }

      if (options.cleanTarget === true) {
        tasks.push(function (callback) {
          cleanDir(taskOptions.targetDir, callback);
        });
      }

      if (options.copyToTarget === true) {
        tasks.push(function (callback) {
          copyPackages(taskOptions.targetDir, callback);
        });
      }

      async.series(tasks, function(){
        console.log('Bower plugins ready.'.cyan);
        done();
      });

    }
  );

};