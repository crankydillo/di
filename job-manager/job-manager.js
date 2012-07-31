$(document).ready(function(){
    /*
    $.get(
        'http://localhost/di/services/batch/jobs?verbose=true'
        , function(xml) {
            $('.mai').append("<p>" + xml + "</p>");
        }
        , 'jsonp');
        */
    addExistingJobs();

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
          if ("JOB_ENDED" === jobEvent.jobEvent.eventName)
            removeJob(jobId);
          else 
            updateJob(jobEvent);
        } else {
          addJob(jobId, new Date(parseInt(jobEvent.jobEvent.timeStamp)), 
              jobEvent.jobEvent.eventName);
        }

        var eventsId = jobEventsId(jobId);
        var events = $('.events');
        var jobEvents = $('.events').find('#' +  eventsId);
        if (jobEvents.length) {
          console.log("Adding job event");
          jobEvents.append("<p class='event'>" + message.body + "</p>");
        } else {
          events.append("<div id='" + eventsId + "' style='display: none'>" +
              "<p class='event'>" + message.body + "</p></div>");
        }
      });
    };
   
    //var host = window.location.host; 
    var host = "localhost"
    console.log("host: " + host);
    var url = 'ws://' + host + ':61614/stomp';
    var login = 'guest';
    var passcode = 'guest';
    destination = '/topic/pervasive.job.event.topic1';

    client = Stomp.client(url);
    console.log("Connecting");
    client.connect(login, passcode, onconnect);
});

function removeJob(jobId) {
  $('#' + jobId).remove();
  $('#' + jobEventsId(jobId)).remove();
}

function jobEventsId(jobId) {
  return jobId + '_events';
}

// Add RUNNING or QUEUED jobs by querying the service (not through Stomp events)
function addExistingJobs() {

    function getJobs(statuss) {
        $.get('../di/services/batch/jobs?verbose=true&status=' + statuss
                , function(xml) {
                    $('job', xml).each(function(i) {
                        jobHref = $(this).attr("xlink:href");
                        jobId = jobHref.split("/").pop();
                        startDate = new Date($(this).find("submissionDate").text());
                        addJob(jobId, startDate, statuss);
                    });
                }
                , 'xml');
    }

    getJobs("QUEUED");
    getJobs("RUNNING");
}

function addJob(jobId, startDate, eventName) {
    var intervalId = setInterval(function() {
        updateDuration(jobId);
    }, 1000);
    addJobRow(jobId, startDate, eventName, intervalId);
    $('#' + jobId).contextMenu({
        menu: 'myMenu'
    }, function(action, el, pos) {
        if (action == 'view-events') {
            var events = $('.events');
            var jobEvents = events.find('#' +  jobEventsId(jobId));
            $(function(){
                //$("<div title='" + jobId + " Events'></div>")
                //.html(jobEvents.html())
                jobEvents
                .dialog({
                    width: 800
                });
            });
        } else if (action == 'view-log') {
            $.get(
                '../di/services/batch/jobs/' + jobId + '/log'
                , function(text) {
                    var txt = text.replace(/([^>\r\n]?)(\r\n|\n\r|\r|\n)/g, '$1<br/>$2');
                    $("<div title='" + jobId + " Log'></div>")
                .html("<p>" + txt + "</p>")
                .dialog({
                    width: 500 
                });
                }
                , 'text');
        }
    });
}

function addJobRow(jobId, startDate, eventName, intervalId) {
    // assert eventName == 'JOB_QUEUED'
    $('.jobs').append(
            "<tr id=\"" + jobId + "\">" +
                "<td>" + formatTime(startDate) + "</td>" +
                "<td>" + jobId + "</td>" +
                "<td id='status'>" + eventName + "</td>" +
                "<td id='" + intervalId + "'><span id='hrs'>00</span>:<span id='mins'>00</span>:<span id='secs'>00</span></td>" +
            "</tr>");
}

function updateJob(jobEvent) {
    var jobId = jobEvent.jobEvent.jobId;
    var eventName = jobEvent.jobEvent.eventName;
    var statuss;
    if (eventName == "PROCESS_STATUS")
        statuss = "STEP: " + jobEvent.jobEvent.data.name;
    else
        statuss = eventName;
    $('#' + jobId).find('#status').text(statuss);
    if (eventName == "JOB_ENDED")
        clearInterval($('#' + jobId).find("td")[3].id);
}

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
    function pad2(value) {
        if (value < 10) return "0" + value;
        else return value + "";
    }

    return pad2(date.getHours()) + ":" + pad2(date.getMinutes()) + ":" + 
        pad2(date.getSeconds());
}


// chronograph helper thing
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
