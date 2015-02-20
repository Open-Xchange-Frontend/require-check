/*
 * grunt-require-check
 * https://github.com/Open-Xchange-Frontend/require-check
 *
 * Copyright (c) 2015 David Bauer
 * Licensed under the MIT license.
 */

'use strict';

var chalk = require('chalk');

module.exports = function(grunt) {

  // Please see the Grunt documentation for more information regarding task
  // creation: http://gruntjs.com/creating-tasks

   grunt.registerMultiTask('require_check', 'Check require.js dependences', function () {

        RegExp.prototype.execMultiple = function (str) {
            var match = null,
                matches = [];

            while (match = this.exec(str)) {
                var matchArray = [];
                for (var i in match) {
                    if (parseInt(i) == i) matchArray.push(match[i]);
                }
                matches.push(matchArray);
            }
            return matches;
        };

        var options = this.options({
            ignored_namespace_regex: false,
            define: true,
            define_dependencies: true,
            require: true,
            build_path: 'build/',
            apps_path: 'apps/'
        }),

        files = this.filesSrc,

        errorCount = 0,

        processContent = function (filepath) {
            var content = grunt.file.read(filepath);
            if (options.define) processDefines(content, filepath);
            if (options.require) processRequires(content, filepath);
        },

        processDefines = function (content, filepath) {
            var matches = content.match(/define(?:.async)?\('([^\s']+)',\s*(?:\[\s*('[^\s']*'(?:,\s+'[^\s']*')*)\s*\])?/);

            if (matches) {
                if ('apps/' + matches[1] + '.js' !== filepath) {
                    matchingFileExists(matches[1], filepath, matches, true);
                }
                if (options.define_dependencies && hasDependencies(matches)) {
                    processDependencies(filepath, matches);
                }
            }
        },

        processRequires = function (content, filepath) {
            var matches = /(?:require|ox.load)\((?:\'([^\s']+)')?(?:\[\s*('[^\s']*'(?:,\s+'[^\s']*')*)\s*\])?/g.execMultiple(content);

            matches.forEach(function (match) {
                if (hasDependencies(match)) {
                    processDependencies(filepath, match);
                } else if (match[1] !== undefined) {
                    matchingFileExists(match[1], filepath, match);
                }
            });
        },

        processDependencies = function (filepath, match) {
            match[2].match(/'[^']*'/g).forEach(function (dependency) {
                matchingFileExists(dependency, filepath, match);
            });
        },

        hasDependencies = function (matches) {
            return (matches[2] !== undefined);
        },

        matchingFileExists = function (dep, filepath, matches, isDefine) {
            dep = dep.replace(/'/g, '');
            var file = dep,
                ignored = new RegExp(options.ignored_namespace_regex);

            if (/^(settings|gettext|themes|withPluginsFor)!?/.test(dep)) {
                // ignore settings and gettext
                file = false;
            } else if (options.ignored_namespace_regex && ignored.test(dep)) {
                grunt.verbose.writeln('Ignored: ' + dep);
                file = false;
            } else if (/^(css|less|raw|text)!/.test(dep)) {
                file = dep.split('!');
                file = options.build_path + options.apps_path + file[1] + (file[0] === 'less' ? '.less' : '');
            } else if (/^static\/(?:.*).js$/.test(dep)) {
                file = options.build_path + dep;
            } else if (!(/.js$/.test(dep))) {
                file = options.build_path + options.apps_path + dep + '.js';
            } else {
                file = options.build_path + dep;
            }

            grunt.verbose.writeln('Source: ' + filepath);

            if (!file) {
                grunt.verbose.oklns('Ignored: ' + dep);
            } else if (grunt.file.exists(file)) {
                grunt.verbose.oklns('File exists: ' + file);
            } else {
                if (isDefine) {
                    grunt.log.errorlns(chalk.bold.yellow('Define does not match file in: ' + filepath));
                } else {
                    grunt.log.errorlns(chalk.bold.yellow('Required file not found in: ' + filepath));
                }
                grunt.log.errorlns(matches[0].replace(dep, chalk.bold.red(dep)));
                grunt.log.writeln();
                errorCount++;
            }
        };

        files.forEach(processContent);

        if (errorCount > 0) {
            grunt.log.errorlns(chalk.bold.red('Encountered ' + errorCount + ' errors.'));
            return false;
        }
    });
};
