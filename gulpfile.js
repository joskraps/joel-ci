var gulp = require('gulp'),
    path = require('path');

gulp.task('test', function () {
    console.log('BOOM');
	return true;
});

gulp.task('default', ['test']);
