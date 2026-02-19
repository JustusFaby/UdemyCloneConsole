import store from '../data/DataStore.js';
import { User, UserRole } from '../models/User.js';
import { hashPassword, verifyPassword } from '../utils/PasswordHasher.js';

class AuthService {
  constructor() {
    this.currentUser = null;
    this._seedAdmin();
  }

  /** Seed a default admin account if none exists */
  _seedAdmin() {
    const adminExists = store.users.some(u => u.role === UserRole.ADMIN);
    if (!adminExists) {
      const admin = new User({
        email: 'admin@udemy.com',
        passwordHash: hashPassword('Admin@123'),
        firstName: 'Platform',
        lastName: 'Admin',
        role: UserRole.ADMIN,
      });
      store.addUser(admin);
    }
  }

  /**
   * Register a new user.
   * @returns {{ success: boolean, message: string, user?: User }}
   */
  register({ email, password, firstName, lastName, role }) {
    // Validate email format
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { success: false, message: 'Invalid email format.' };
    }
    // Check duplicate
    if (store.findUserByEmail(email)) {
      return { success: false, message: 'An account with this email already exists.' };
    }
    // Validate password strength
    if (!password || password.length < 6) {
      return { success: false, message: 'Password must be at least 6 characters.' };
    }
    // Prevent self-registration as Admin
    if (role === UserRole.ADMIN) {
      return { success: false, message: 'Admin accounts can only be created by existing admins.' };
    }

    const user = new User({
      email,
      passwordHash: hashPassword(password),
      firstName,
      lastName,
      role: role || UserRole.STUDENT,
    });

    store.addUser(user);
    return { success: true, message: 'Registration successful!', user };
  }

  /**
   * Log in an existing user.
   * Handles the case where an Instructor logs in choosing the Student role:
   *   - Instructors are allowed to browse/enroll like students (dual-role).
   * @returns {{ success: boolean, message: string, user?: User }}
   */
  login(email, password) {
    const user = store.findUserByEmail(email);
    if (!user) {
      return { success: false, message: 'No account found with that email.' };
    }
    if (user.isBanned) {
      return { success: false, message: 'This account has been banned. Contact support.' };
    }
    if (!verifyPassword(password, user.passwordHash)) {
      return { success: false, message: 'Incorrect password.' };
    }

    this.currentUser = user;
    return { success: true, message: `Welcome back, ${user.fullName}!`, user };
  }

  /**
   * When an instructor logs in, they may choose to act as a Student.
   * We allow dual-role access: they keep their Instructor id but can
   * enroll in courses, leave reviews, etc.
   */
  getEffectiveRole(chosenRole) {
    if (!this.currentUser) return null;

    // An instructor choosing "Student" gets student capabilities
    // but we flag it so we can show both menus if needed.
    if (this.currentUser.role === UserRole.INSTRUCTOR && chosenRole === UserRole.STUDENT) {
      return UserRole.STUDENT; // they operate as student for this session
    }
    return this.currentUser.role;
  }

  /** Checks if the current user is an instructor acting as student */
  isInstructorActingAsStudent(sessionRole) {
    return (
      this.currentUser &&
      this.currentUser.role === UserRole.INSTRUCTOR &&
      sessionRole === UserRole.STUDENT
    );
  }

  logout() {
    const name = this.currentUser?.fullName || 'User';
    this.currentUser = null;
    return `Goodbye, ${name}!`;
  }

  /** Admin: promote a user to a different role */
  promoteUser(userId, newRole) {
    const user = store.findUserById(userId);
    if (!user) return { success: false, message: 'User not found.' };
    user.role = newRole;
    user.updatedAt = new Date().toISOString();
    store.saveUsers();
    return { success: true, message: `${user.fullName} is now a ${newRole}.` };
  }

  /** Admin: ban/unban a user */
  toggleBan(userId) {
    const user = store.findUserById(userId);
    if (!user) return { success: false, message: 'User not found.' };
    if (user.role === UserRole.ADMIN) return { success: false, message: 'Cannot ban an admin.' };
    user.isBanned = !user.isBanned;
    user.updatedAt = new Date().toISOString();
    store.saveUsers();
    return { success: true, message: `${user.fullName} has been ${user.isBanned ? 'banned' : 'unbanned'}.` };
  }

  /** Admin: reset a user's password */
  resetPassword(userId, newPassword) {
    const user = store.findUserById(userId);
    if (!user) return { success: false, message: 'User not found.' };
    if (newPassword.length < 6) return { success: false, message: 'Password must be at least 6 characters.' };
    user.passwordHash = hashPassword(newPassword);
    user.updatedAt = new Date().toISOString();
    store.saveUsers();
    return { success: true, message: `Password reset for ${user.fullName}.` };
  }
}

const authService = new AuthService();
export default authService;
