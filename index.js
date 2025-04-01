const { Client, GatewayIntentBits, Partials } = require('discord.js');
const fetch = require('node-fetch');
const crypto = require('crypto');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.DirectMessageReactions
  ],
  partials: [Partials.Channel, Partials.Message, Partials.Reaction]
});

client.on('messageReactionAdd', async (reaction, user) => {
  if (reaction.partial) {
    try {
      await reaction.fetch();
    } catch (err) {
      console.error('Error fetching partial reaction:', err);
      return;
    }
  }
});

const flairs = [
  { code: 'degree.pencil', name: 'The Pencil Flair' },
  { code: 'degree.bacon', name: 'The Pig Flair' },
  { code: 'degree.baseball', name: 'The Baseball Flair' },
  { code: 'degree.moon', name: 'The Moon Flair' }
];

const kv = {
  put: async (key, value) => {
    // Implement your Cloudflare Workers KV API call here.
  }
};

const MAX_STEPS = 3;
let step = 0;

client.once('ready', async () => {
  const guildId = '1356506667818287216';
  const guild = client.guilds.cache.get(guildId);
  if (!guild) {
    console.error('Guild not found. Check your guild ID.');
    return;
  }
  try {
    await guild.commands.create({
      name: 'verify',
      description: 'Starts the verification process',
      options: [
        {
          name: 'userid',
          type: 3, // STRING
          description: 'TagPro Profile ID',
          required: true
        }
      ]
    });
  } catch (error) {
    console.error('Error registering slash command:', error);
  }
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isCommand()) return;

  if (interaction.commandName === 'verify') {
    const profileId = interaction.options.getString('userid');
    let response;
    try {
      response = await fetch(`https://tagpro.koalabeast.com/profile/${profileId}`);
    } catch (err) {
      console.error('Error fetching TagPro profile:', err);
      await interaction.reply({ content: 'Error connecting to TagPro. Please try again later.', ephemeral: true });
      return;
    }

    const html = await response.text();
    const nameMatch = html.match(/<title>TagPro Ball: ([^<]+)<\/title>/);
    if (!nameMatch) {
      await interaction.reply({ content: 'Invalid profile ID.', ephemeral: true });
      return;
    }
    const name = nameMatch[1];

    await interaction.reply({ content: 'Verification process started! Check your DMs.', ephemeral: true });

    let dmChannel;
    try {
      dmChannel = await interaction.user.createDM();
    } catch (err) {
      console.error('Error opening DM channel:', err);
      return;
    }
    verificationStep(interaction.user, dmChannel, name, profileId);
  }
});

async function verificationStep(user, dmChannel, name, profileId) {
  const randomFlair = flairs[Math.floor(Math.random() * flairs.length)];

  const instructionMsg = await dmChannel.send(
    `Hello ${name}, please change your flair to **${randomFlair.name}** (${randomFlair.code}) and click the :white_check_mark: reaction below.\n(Alternatively, try reacting with another emoji if you run into issues.)`
  );

  try {
    await instructionMsg.react('✅');
  } catch (err) {
    console.error("Error adding reaction:", err);
    await dmChannel.send("Failed to add reaction. Please try again later.");
    return;
  }

  const filter = (reaction, reactor) =>
    reaction.emoji.name === '✅' && reactor.id === user.id;

  const collector = instructionMsg.createReactionCollector({
    filter,
    max: 1,
    time: 60000
  });

  collector.on("collect", async (reaction, reactor) => {
    // Refetch the profile page to check the current flair
    let profileResponse;
    try {
      profileResponse = await fetch(`https://tagpro.koalabeast.com/profile/${profileId}`);
    } catch (err) {
      console.error('Error fetching profile for flair check:', err);
      await dmChannel.send("Error checking your flair. Please try again later.");
      return;
    }
    const profileHtml = await profileResponse.text();
    // Regex to extract the flair (simulating the curl command)
    const flairRegex = /flair-item selected[^>]*data-flair="([^"]+)"/;
    const flairMatch = profileHtml.match(flairRegex);

    if (!flairMatch || flairMatch[1] !== randomFlair.code) {
      await dmChannel.send("Wrong flair selected. Please try again.");
      return;
    }

    await dmChannel.send("You reacted with ✅ and the correct flair was detected!");

    step++;
    if (step < MAX_STEPS) {
      await dmChannel.send(`Proceeding to step ${step + 1}...`);
      verificationStep(user, dmChannel, name, profileId);
    } else {
      await dmChannel.send("Verification complete!");
    }
  });

  collector.on("end", (collected) => {
    if (collected.size === 0) {
      dmChannel.send("You didn't react in time!");
    }
  });
}

client.on('error', console.error);

client.login('MTM1NjUwNTE4MTYxMjY3NTExMg.GakhEa.9q8xzm7CWQd5voBgGnpjugFbsiwFmZvnNRDQBg');
