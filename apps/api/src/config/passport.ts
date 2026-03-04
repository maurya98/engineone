import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import { findUserByEmail, verifyPassword } from '../services/user.service.js';
import { toSafeUser } from '../types/user.js';

passport.use(
  new LocalStrategy(
    { usernameField: 'email', passwordField: 'password' },
    async (email, password, done) => {
      try {
        const user = await findUserByEmail(email);
        if (!user) return done(null, false, { message: 'Invalid email or password' });
        if (!user.password_hash) return done(null, false, { message: 'Invalid email or password' });
        const ok = await verifyPassword(password, user.password_hash);
        if (!ok) return done(null, false, { message: 'Invalid email or password' });
        return done(null, toSafeUser(user));
      } catch (err) {
        return done(err);
      }
    }
  )
);

passport.serializeUser((user, done) => {
  done(null, (user as { id: string }).id);
});

passport.deserializeUser(async (id: string, done) => {
  try {
    const { findUserById } = await import('../services/user.service.js');
    const user = await findUserById(id);
    if (!user) return done(null, null);
    return done(null, toSafeUser(user));
  } catch (err) {
    return done(err);
  }
});
