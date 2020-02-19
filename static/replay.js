(function() {
  let S = 6;
  const packDiv = document.querySelector('#pack');
  const picksDiv = document.querySelector('#picks');
  let R = 1;
  function getDraftObject() {
    let Draft = JSON.parse(window.DraftString);

    Draft.events.sort((a, b) => {
      if (a.round < b.round) {
        return 1;
      }
      if (a.round > b.round) {
        return -1;
      }
      if (a.playerModified < b.playerModified) {
        return 1;
      }
      if (a.playerModified > b.playerModified) {
        return -1;
      }
      if (a.player < b.player) {
        return 1;
      }
      if (a.player > b.player) {
        return -1;
      }
      return 0;
    });

    Draft.groups = [];
    var eventsIndex = Draft.events.length;
    var groupIndex = 0;
    while (--eventsIndex >= 0) {
      var event = Draft.events[eventsIndex];
      var inserted = false;
      if (i === groupIndex && Draft.groups[i].every((v) => v != null)) {
        groupIndex++;
      }
      for (var i = groupIndex; i <= Draft.groups.length; i++) {
        if (i === Draft.groups.length) {
          Draft.groups.push([null,null,null,null,null,null,null,null]);
        }
        if (!Draft.groups[i][event.player]) {
          if (Draft.groups[i].every((v) => v == null || v.round === event.round)) {
            Draft.groups[i][event.player] = event;
            inserted = true;
            break;
          }
        }
      }
      if (!inserted) {
        console.log('bad');
        debugger;
      }
    }

    Draft.pastEvents = [];
    return Draft;
  }
  let Draft = getDraftObject();
  window.Draft = Draft;
  function doNext() {
    var lastEvent = Draft.events[Draft.events.length-1];
    var round = lastEvent.round;
    var eventCount = 0;
    var eventz = new Array(8);
    var reset = [];
    do {
      lastEvent = Draft.events[Draft.events.length-1];
      if (eventz[lastEvent.player]) {
        reset.push(Draft.events.pop());
        continue;
      }
      eventz[lastEvent.player] = lastEvent;      
      eventCount++;

      var nextEvent = Draft.events.pop();
      Draft.pastEvents.push(nextEvent);

      var pickedCardIndex = Draft.seats[nextEvent.player].rounds[R].packs[0].cards.findIndex(v => v.name === nextEvent.card1);
      var removedCard = Draft.seats[nextEvent.player].rounds[R].packs[0].cards.splice(pickedCardIndex, 1)[0];
      Draft.seats[nextEvent.player].rounds[0].packs[0].cards.push(removedCard);

      if (nextEvent.card2) {
        var pickedCardIndex = Draft.seats[nextEvent.player].rounds[R].packs[0].cards.findIndex(v => v.name === nextEvent.card2);
        var removedCard = Draft.seats[nextEvent.player].rounds[R].packs[0].cards.splice(pickedCardIndex, 1)[0];
        Draft.seats[nextEvent.player].rounds[0].packs[0].cards.push(removedCard);

        var librarianIndex = Draft.seats[nextEvent.player].rounds[0].packs[0].cards.findIndex(v => v.name === 'Cogwork Librarian');
        var removedCard = Draft.seats[nextEvent.player].rounds[0].packs[0].cards.splice(librarianIndex, 1)[0];
        Draft.seats[nextEvent.player].rounds[R].packs[0].cards.push(removedCard);
      }

      var nextSeat;
      if (R % 2 === 0) {
        nextSeat = nextEvent.player - 1;
        if (nextSeat === -1) {
          nextSeat = 7;
        }
      } else {
        nextSeat = nextEvent.player + 1;
        if (nextSeat === 8) {
          nextSeat = 0;
        }
      }

      var packToPass = Draft.seats[nextEvent.player].rounds[R].packs.splice(0, 1)[0];
      Draft.seats[nextSeat].rounds[R].packs.push(packToPass);

      if (nextEvent.card1 === 'Lore Seeker') {
        Draft.seats[nextEvent.player].rounds[R].packs.unshift({
          cards: Draft.extraPack
        });
        delete Draft.extraPack;
      }

    } while (Draft.events.length > 0 && eventCount < 8 && Draft.events[Draft.events.length-1].round === round);

    if (reset.length) {
      Draft.events = Draft.events.concat(reset);
    }

    if (!Draft.events.length) {
      console.log('all done!');
    } else if (Draft.events[Draft.events.length-1].round !== R) {
      console.log('moving to next round');
      R++;
    }

    displayCurrentState();
  }
  function doPrevious() {
    console.error('doesn\'t work yet');
  }
  function displayCurrentState() {
    var picks = Draft.seats[S].rounds[0].packs[0].cards;
    for (var i = 0; i < picks.length; i++) {
      if (!picksDiv.querySelector('#' + normalizeCardName(picks[i].name))) {
        addCardImage(picksDiv, picks[i]);
      }
    }

    while (packDiv.firstChild) {
      packDiv.removeChild(packDiv.firstChild);
    }

    var pack = Draft.seats[S].rounds[R].packs[0].cards;
    for (var i = 0; i < pack.length; i++) {
      addCardImage(packDiv, pack[i]);
    }

    for (var i = Draft.events.length - 1; i >= 0; i--) {
      if (Draft.events[i].player !== S) {
        continue;
      }
      document.querySelector('#' + normalizeCardName(Draft.events[i].card1)).classList.add('selected');
      if (Draft.events[i].card2) {
        document.querySelector('#' + normalizeCardName(Draft.events[i].card2)).classList.add('selected');
      }
      break;
    }
  }
  function addCardImage(div, card) {
    var ret = document.createElement('div');
    var img = document.createElement('img');
    var name = document.createElement('div');
    ret.append(img, name);
    img.src = 'http://api.scryfall.com/cards/' + card.edition + '/' + card.number + '?format=image&version=normal';
    img.height = '300';
    name.textContent = card.name;
    ret.id = normalizeCardName(card.name);
    ret.classList.add('card');
    if (card.tags) {
      var tags = document.createElement('div');
      tags.textContent = card.tags;
      ret.append(tags);
    }

    div.append(ret);
  }
  function normalizeCardName(n) {
    return n.replace(/[\W]/g, '').toLowerCase();
  }
  function switchSeat(newseat) {
    if (S !== newseat) {
      S = newseat;
      displayCurrentState();
    } else {
      console.log('already on that seat');
    }
  }
  window.next = doNext;
  window.prev = doPrevious;
  window.seat = switchSeat;
  displayCurrentState();
}())