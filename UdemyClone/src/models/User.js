import crypto from 'crypto';

export const UserRole = Object.freeze({
  STUDENT: 'Student',
  INSTRUCTOR: 'Instructor',
  ADMIN: 'Admin',
});

export class User {
  constructor({ email, passwordHash, firstName, lastName, role = UserRole.STUDENT }) {
    this.id = crypto.randomUUID();
    this.email = email.toLowerCase().trim();
    this.passwordHash = passwordHash;
    this.firstName = firstName;
    this.lastName = lastName;
    this.role = role;
    this.isBanned = false;
    this.createdAt = new Date().toISOString();
    this.updatedAt = new Date().toISOString();
  }

  get fullName() {
    return `${this.firstName} ${this.lastName}`;
  }

  /** Returns true if this user is an instructor trying to act as a student */
  isInstructorActingAsStudent() {
    return this.role === UserRole.INSTRUCTOR;
  }

  toSafeObject() {
    const { passwordHash, ...safe } = this;
    return safe;
  }

  static fromJSON(json) {
    const user = Object.create(User.prototype);
    return Object.assign(user, json);
  }
}
