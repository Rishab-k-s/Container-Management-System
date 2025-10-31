import { Meteor } from 'meteor/meteor';
import { Accounts } from 'meteor/accounts-base';
import './Login.js'; 

Meteor.methods({
  // Get the role of the currently logged-in user
  'users.getRole'() {
    if (!this.userId) {
      throw new Meteor.Error('not-authorized', 'You must be logged in');
    }

    const user = Meteor.users.findOne(this.userId);
    
    if (!user) {
      throw new Meteor.Error('user-not-found', 'User not found');
    }

    // Return the role from the user's profile, default to 'user' if not set
    return user.profile?.role || 'user';
  },

  // Set the role for a newly registered user
  'users.setRoleOnRegistration'(role) {
    if (!this.userId) {
      throw new Meteor.Error('not-authorized', 'You must be logged in');
    }

    // Validate role
    if (role !== 'user' && role !== 'admin') {
      throw new Meteor.Error('invalid-role', 'Role must be either "user" or "admin"');
    }

    // Update the user's profile with the selected role
    Meteor.users.update(this.userId, {
      $set: {
        'profile.role': role
      }
    });

    return true;
  }
});
