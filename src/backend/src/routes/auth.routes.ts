import { Router } from 'express';
import {
    getMe, postRegister, postLogin, postForgotPassword, postResetPassword
    , patchMe, postChangePassword
} from '../controllers/auth.controller';
import { requireAuth } from '../middlewares/auth';

const r = Router();
r.post('/login', postLogin);
r.post('/register', postRegister);
r.get('/me', requireAuth, getMe);
r.post('/forgot-password', postForgotPassword);
r.patch('/me', requireAuth, patchMe);
r.post('/reset-password', postResetPassword);
r.post('/change-password', requireAuth, postChangePassword)

export default r;
