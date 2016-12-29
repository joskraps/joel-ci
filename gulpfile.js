const gulp = require('gulp');
const eslint = require('gulp-eslint');

gulp.task('lint', () => gulp.src(['app.js', './src/**.js'])
    .pipe(eslint())
    .pipe(eslint.format())
    .pipe(eslint.failAfterError()));

gulp.task('default', ['lint'], () => {
    // only runs if test and lint tasks complete successfully
});
