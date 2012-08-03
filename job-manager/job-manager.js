$(document).ready(function(){
    /*
    $.get(
        'http://localhost/di/services/batch/jobs?verbose=true'
        , function(xml) {
            $('.mai').append("<p>" + xml + "</p>");
        }
        , 'jsonp');
        */

  var supported = ("WebSocket" in window);
  if(!supported) {
    var msg = "Your browser does not support Web Sockets. This example will not work properly.<br>";
    msg += "Please use a Web Browser with Web Sockets support (WebKit or Google Chrome).";
    $("#connect").html(msg);
  }    

  getJobs();

    //addExistingJobs();

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
        console.log(eventsId);
        var jobEvents = $('#' +  eventsId);
        if (jobEvents.length) {
          console.log("Adding job event");
          jobEvents.append("<p class='event'>" + message.body + "</p>");
        } else {
          /*
          events.append("<div id='" + eventsId + "' style='display: none'>" +
              "<p class='event'>" + message.body + "</p></div>");
              */
        }
      });
    };
   
    var host = window.location.host; 
    //var host = "localhost"
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
  //$('#' + jobEventsId(jobId)).remove();
}

function jobEventsId(jobId) {
  return jobId + '_events';
}

function parseIsoToDate(str) {
  var arr = str.split('T');
  var date_part = arr[0];
  var time_part = arr[1];
  var offset;
  var time_arr;
  if (time_part.indexOf('-') === -1) {
    time_arr = time_part.split('+');
    offset = "+" + time_arr[1].replace(":", "");
  } else {
    time_arr = time_part.split('-');
    offset = "-" + time_arr[1].replace(":", "");
  }

  var time_without_millis = time_arr[0].substr(0, time_arr[0].length - 4);
  var to_parse = date_part + " " + time_without_millis + offset;
  return Date.parse(to_parse);
}

function getJobs() {
  $.get('../di/services/batch/jobs?verbose=true&last=86400'
      , function(xml) { 
        var fst = 0;
        $('job', xml).each(function(i) {
          var job_href = $(this).attr("xlink:href");
          var job_id = job_href.split("/").pop();

          /* Why doesn't this work?
          var ths = $(this);
          var f = function(field) { ths.find(field).text() }
          var dt = function(field) { new Date(f(field)) }
          */
          
          var job_id = job_href.split("/").pop();

          var start_date = parseIsoToDate($(this).find("submissionDate").text());

          var end_date;
          var maybe_end_date = $(this).find("endDate");
          if (maybe_end_date.length)
            end_date = parseIsoToDate(maybe_end_date.text());

          var statuss = $(this).find("status").text();
          
          if (typeof end_date === "undefined") {
            addJob(job_id, start_date, statuss);
          } else {
            addLogRow(job_id, start_date, end_date, statuss);
          }
        });
        return xml 
      }, 'xml');
}

function addLogTab(jobId) {
  addTab(
      logTabId(jobId)
      , "Log"
      , getLog(jobId)
      , "Log for " + jobId
      );
}

function logTabId(jobId) {
  return "tl_" + jobId;
}

// Retrieve the job log from the server
function getLog(jobId) {
  var res = null;
  $.ajax({
    url: '../di/services/batch/jobs/' + jobId + '/log'
    , type: "get"
    , async: false
    , success: function(text) {
      res = text.replace(/([^>\r\n]?)(\r\n|\n\r|\r|\n)/g, '$1<br/><br/>$2');
    }, error: function(jqHXR, respCode, errorThrown) {
      res = noLogLog();
    }
  });
  return res;
}

function noLogLog() {
  var msg = "";
  for (var i = 0; i < 1000; i++) {
    msg += "Unable to retrieve log.<br/>";
  }
  return msg;
}

// snabbed from jquery tabs site
function addTab(tab_id, tab_title, content, header) {
  var container = $("<div id='" + tab_id + "_c' class='content'/>");
  container.html(content);
  if (typeof header !== "undefined") {
    container.prepend("<h3>" + header + "</h3>");
  }
  $("#dtabc").append(container);
  $("#tabs").tabs("add", "#" + tab_id, tab_title);
}

function addJob(jobId, startDate, eventName) {
    var intervalId = setInterval(function() {
        updateDuration(jobId);
    }, 1000);
    addJobRow(jobId, startDate, eventName, intervalId);
}

function addLogRow(jobId, startDate, endDate, status) {
  var id = "rep_" + jobId;
  var row = $(
    "<tr>" +
      "<td><a href='#" + id + "'>" + jobId + "</td>" +
      "<td>" + formatTime(startDate) + "</td>" +
      "<td>" + formatTime(endDate) + "</td>" +
      "<td>" + status + "</td>" +
    "</tr>"
    ).click( function() {
      addLogTab(jobId);
      $("#tabs").tabs('select', logTabId(jobId));
    });

  $('#report').append(row);
}

function addJobRow(jobId, startDate, eventName, intervalId) {
  var row = $(
      "<tr id=\"" + jobId + "\">" +
      "<td>" + jobId + "</td>" +
      "<td id='" + intervalId + "'><span id='hrs'>00</span>:<span id='mins'>00</span>:<span id='secs'>00</span></td>" +
      "<td id='status'>" + eventName + "</td>" +
      "</tr>"
    ).click( function() {
      addJobTab(jobId);
      $("#tabs").tabs('select', jobTabId(jobId));
    });

  $('#jobs').append(row);
}

function addJobTab(jobId) {
  var eventsId = jobEventsId(jobId);
  var jobEvents = $("<div id='" + eventsId + "'/>");
  addTab(jobTabId(jobId), "Job", jobEvents);
}

function jobTabId(jobId) {
  return "tj_" + jobId;
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
