import { Meteor } from 'meteor/meteor';
import { LinksCollection } from '/imports/api/links';
import './Login.js';  // Import Login methods
import './DockerMethods.js';  // Import Docker methods
import './ConnectionSocketHandler.js';  // Import Socket handler

async function insertLink({ title, url }) {
  await LinksCollection.insertAsync({ title, url, createdAt: new Date() });
}

Meteor.startup(async () => {
  // If the Links collection is empty, add some data.
  console.log("Server Started");
});
