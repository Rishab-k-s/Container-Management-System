import { Meteor } from 'meteor/meteor';
import { Accounts } from 'meteor/accounts-base';

// Set up user profile on creation
Accounts.onCreateUser((options, user) => {
  // Create profile with role
  user.profile = options.profile || {};
  user.profile.role = options.profile?.role || 'user';
  return user;
});

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
});
