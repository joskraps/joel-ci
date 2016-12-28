const gulp = require('gulp');
const eslint = require('gulp-eslint');

gulp.task('lint', function () {
  return gulp.src(['app.js','./src/**.js'])
    .pipe(eslint())
    .pipe(eslint.format())
    .pipe(eslint.failAfterError());
});

gulp.task('test', function () {
    console.log('BOOM');
	return true;
});

gulp.task('default', ['test','lint'],function(){
    //only runs if test and lint tasks complete successfully
});
