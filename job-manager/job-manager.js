$(document).ready(function(){
    /*
    $.get(
        'http://localhost/di/services/batch/jobs?verbose=true'
        , function(xml) {
            $('.mai').append("<p>" + xml + "</p>");
        }
        , 'jsonp');
        */

    var client, destination;

    $(window).unload(function() {
      console.log("Disconnecting");
      if (client != null) 
        client.disconnect();
    });

    var onconnect = function(frame) {
      console.log("connected to Stomp");
      
      client.subscribe(destination, function(message) {
        var jobEvent = JSON.parse(message.body);
        var jobId = jobEvent.jobEvent.jobId;
        if ($('#' + jobId).length) {
            var eventName = jobEvent.jobEvent.eventName;
            var statuss;
            if (eventName == "PROCESS_STATUS")
                statuss = "STEP: " + jobEvent.jobEvent.data.name;
            else
                statuss = eventName;
            $('#' + jobId).find('#status').text(statuss);
            if (eventName == "JOB_ENDED")
                clearInterval($('#' + jobId).find("td")[2].id);
        } else {
            var intervalId = setInterval(function() {
                updateDuration(jobId);
            }, 1000);
            $('.jobs').append(jobEventToRow(jobEvent, intervalId));
            $('#' + jobId).contextMenu({
              menu: 'myMenu'
              }, function(action, el, pos) {
                /*
              alert(
              'Action: ' + action + '\n\n' +
              'Element text: ' + $(el).text() + '\n\n' + 
              'Job ID: ' + jobId
              );
              */
              if (action == 'view-events') {
                var events = $('.events');
                var jobEvents = events.find('#' +  jobId + '_events');
                jobEvents.show();
              }
            });
        }

        var jobEventsId = jobId + '_events';
        var events = $('.events');
        var jobEvents = $('.events').find('#' +  jobEventsId);
        if (jobEvents.length) {
          console.log("Adding job event");
          jobEvents.append("<p class='event'>" + message.body + "</p>");
        } else {
          events.append("<div id='" + jobEventsId + "' style='display: none'>" +
              "<h2>Job Events for " + jobId + " (<a href='#f' id='" + jobId + "_hide'>hide</a>)</h2><br/>" + 
              "<p class='event'>" + message.body + "</p></div>");
          $('#' + jobId + '_hide').click(function() {
            $('.events').find('#' + jobEventsId).hide();
          });
        }


      });
    };
    
    var url = 'ws://localhost:61614/stomp';
    var login = 'guest';
    var passcode = 'guest';
    destination = '/topic/pervasive.job.event.topic1';

    client = Stomp.client(url);
    console.log("Connecting");
    client.connect(login, passcode, onconnect);

    $("#click").click(function() {
        $(function(){
            // jQuery UI Dialog
            $("<div title='Events'><p>Event1</p></div>").dialog();
        });
    });

    
});

function jobEventToRow(jobEvent, intervalId) {
    var jobId = jobEvent.jobEvent.jobId;
    // assert eventName == 'JOB_QUEUED'
    var startDate = new Date(parseInt(jobEvent.jobEvent.timeStamp));
    return "<tr id=\"" + jobId + "\">" +
            "<td>" + formatTime(startDate) + "</td>" +
            "<td>" + jobId + "</td>" +
            "<td id='status'>" + jobEvent.jobEvent.eventName + "</td>" +
            "<td id='" + intervalId + "'><span id='hrs'>00</span>:<span id='mins'>00</span>:<span id='secs'>00</span></td>" +
            "</tr>"
}

function formatTime(date) {
    return pad2(date.getHours()) + ":" + pad2(date.getMinutes()) + ":" + 
        pad2(date.getSeconds());
}

function pad2(value) {
    if (value < 10) return "0" + value;
    else return value + "";
}

function updateDuration(jobId) {

    function inc(curr, next) {
        var currSpan = $('#' + jobId).find('#' + curr);
        var currSpanTxt = currSpan.text();
        var curr = 0;
        if (currSpanTxt.charAt(0) == '0')
            curr = parseInt(currSpanTxt.substring(1));
        else
            curr = parseInt(currSpanTxt);
        if (curr == 59) {
            currSpan.text("00");
            inc("mins", "hrs");
        } else {
            if (curr < 9) 
                currSpan.text("0" + (curr + 1));
            else {
                currSpan.text(curr + 1 + "");
            }
        }
    }

    inc("secs", "mins");
}


