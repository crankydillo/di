$(document).ready(function(){

  var supported = ("WebSocket" in window);
  if(!supported) {
    var msg = "Your browser does not support Web Sockets. This example will not work properly.<br>";
    msg += "Please use a Web Browser with Web Sockets support (WebKit or Google Chrome).";
    $("#connect").html(msg);
  }   

  establishMetrics();

  getJobs();

  $("#succ-metric").click(function() {
    showSuccess();
  });
  $("#fail-metric").click(function() {
    showFail();
  });
  $("#run-metric").click(function() {
    showRunning();
  });
  $("#queue-metric").click(function() {
    showQueued();
  });

  $("#jchoice").contextMenu('jmenu'
    , {
      bindings: {
                  'all': function(t) {
                    $('#jchoice').html('All');
                    filterRows('jobs', 'huh');
                  } 
                  , 'running': function(t) {
                    showRunning();
                  }
                  , 'queued': function(t) {
                    showQueued();
                  }
                }
    });

  $("#rchoice").contextMenu('rmenu'
    , {
      bindings: {
                  'all': function(t) {
                    $('#rchoice').html('All');
                    filterRows('report', 'y'); // inefficient
                  } 
                  , 'successful': function(t) {
                    showSuccess();
                  }
                  , 'failed': function(t) {
                    showFail();
                  }
                }
    });

    //addExistingJobs();

    var client, job_event_destination, job_summary_destination;

    $(window).unload(function() {
      console.log("Disconnecting");
      if (client != null) 
        client.disconnect();
    });

    var onconnect = function(frame) {
      console.log("connected to Stomp");
      client.subscribe(job_summary_destination, processJobSummary);
      client.subscribe(job_event_destination, processJobEvent);
    };
   
    var host = window.location.host; 
    //var host = "localhost"
    console.log("host: " + host);
    var url = 'ws://' + host + ':61614/stomp';
    var login = 'guest';
    var passcode = 'guest';
    job_event_destination = '/topic/pervasive.job.event.topic1';
    job_summary_destination = '/topic/di.job.summary.topic';

    client = Stomp.client(url);
    console.log("Connecting");
    client.connect(login, passcode, onconnect);

});

function showRunning() {
  $("#tabs").tabs('select', "t2");
  $('#jchoice').html('Running');
  filterRows('jobs', 'JOB_QUEUED');
}

function showQueued() {
  $("#tabs").tabs('select', "t2");
  $('#jchoice').html('Queued');
  filterNotRows('jobs', 'JOB_QUEUED');
}

function showSuccess() {
  $("#tabs").tabs('select', "t3");
  $('#rchoice').html('Successful');
  filterRows('report', 'FINISHED_ERROR', 'ABORTED');
}

function showFail() {
  $("#tabs").tabs('select', "t3");
  $('#rchoice').html('Failed');
  filterRows('report', 'FINISHED_OK');
}
 

function removeJob(job_id, start_date, end_date, statuss) {
  $('#' + job_id).remove();
  addLogRow(job_id, start_date, end_date, statuss, true);
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

function establishMetrics() {
  $.get('../di/services/mim'
      , function(json) { setMetrics(json); }
      , 'json');
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
            addLogRow(job_id, start_date, end_date, statuss, false);
          }
        });
        return xml 
      }, 'xml');
}

function addLogTab(jobId, statuss) {
    var log = getLog(jobId);
    var statusImg = "<img width='35' height='35' src='" + statusIcon(statuss) + "'/>";
    var content = 
        "<div>" + 
        "<div style='font-size:18px; font-weight: bold;'>Log for " + jobId + "&nbsp;&nbsp;" + statusImg + "</div>" +
        "<br/><br/>" + 
        log + 
        "</div>";

    addTab(
            logTabId(jobId)
            , "Log"
            , content
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

function addJob(jobId, startDate, eventName, statuss) {
    var intervalId = setInterval(function() {
        updateDuration(jobId);
    }, 1000);
    addJobRow(jobId, startDate, eventName, intervalId);
}

function addLogRow(jobId, startDate, endDate, statuss, prepend) {
  var id = "rep_" + jobId;
  var row = $(
    "<tr class='r_" + statuss + "'>" +
      "<td><a href='#" + id + "'>" + jobId + "</td>" +
      "<td>" + formatTime(startDate) + "</td>" +
      "<td>" + formatTime(endDate) + "</td>" +
      "<td><img width='35' height='35' src='" + statusIcon(statuss) + "'/></td>" +
    "</tr>"
    ).click( function() {
      addLogTab(jobId, statuss);
      $("#tabs").tabs('select', logTabId(jobId));
    });

  /*
                    $('#jchoice').html('All');
                    showQueuedRunning();
                  } 
                  , 'running': function(t) {
                    $('#jchoice').html('Running');
                    showRunning();
                  }
                  , 'queued': function(t) {
                    $('#jchoice').html('Queued');
                    showQueued();
                  }
                  */

  if (prepend === true) {
    $('#report').closest("tr").after(row);
  } else {
    $('#report').append(row);
  }
}

function statusIcon(statuss) {
    // TODO What if we don't match...
    var icon;
    if (statuss === "FINISHED_OK") {
        icon = "completed";
    } else if (statuss === "FINISHED_ERROR" || statuss === "ABORTED") {
        icon = "failed";
    } else if (statuss === "RUNNING") {
        icon = "running";
    } else if (statuss === "QUEUED") {
        icon = "queued";
    }
    return "images/" + icon + ".png";
}

function addJobRow(job_id, start_date, event_name, interval_id) {
  var row = $(
      "<tr id='" + job_id + "' class='r_" + event_name + "'>" +
      "<td><a href='#blah'>" + job_id + "</td>" +
      "<td id='" + interval_id + "'><span id='hrs'>00</span>:<span id='mins'>00</span>:<span id='secs'>00</span></td>" +
      "<td id='status'>" + event_name + "</td>" +
      "</tr>"
    ).click( function() {
      addJobTab(job_id);
      $("#tabs").tabs('select', jobTabId(job_id));
    });

  $('#jobs').append(row);
  var filter = $("#jchoice").text();
  if (filter === 'Running') {
    row.hide();
  }

}

function addJobTab(jobId) {
  var eventsId = jobEventsId(jobId);
  var jobEvents = $("<div id='" + eventsId + "'/>");
  addTab(jobTabId(jobId), "Job", jobEvents);
}

function jobTabId(jobId) {
  return "tj_" + jobId;
}

function updateJob(job_event) {
    var job_id = job_event.jobEvent.jobId;
    var event_name = job_event.jobEvent.eventName;
    var statuss;
    if (event_name == "PROCESS_STATUS")
        statuss = "STEP: " + job_event.jobEvent.data.name;
    else
        statuss = event_name;
    $('#' + job_id).find('#status').text(statuss);

    var filter = $("#jchoice").text();
    if (filter === 'Running' || filter === 'All') {
      $('#' + job_id).show();
    } else {
      $('#' + job_id).hide();
    }

    if (event_name == "JOB_ENDED")
        clearInterval($('#' + job_id).find("td")[3].id);
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

function filterRows() {
  var table_id = arguments[0];
  var outer_args = arguments;
  $("#" + table_id + " tr").each(function(idx) {
    if (idx !== 0) {
      var row_status = $(this).attr('class').substring(2);  // prune r_
      if (contains(outer_args, row_status)) {
        $(this).hide();
      } else {
        $(this).show();
      }
    }
  });
}

// TODO Replace this and filterRows with something that uses filter function
function filterNotRows() {
  var table_id = arguments[0];
  var outer_args = arguments;
  $("#" + table_id + " tr").each(function(idx) {
    if (idx !== 0) {
      var row_status = $(this).attr('class').substring(2);  // prune r_
      if (!contains(outer_args, row_status)) {
        $(this).hide();
      } else {
        $(this).show();
      }
    }
  });
}

function contains(arr, obj) {
  for (var i = 0; i < arr.length; i++) {
    if (arr[i] === obj) 
      return true;
  }
  return false;
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

function processJobEvent(message) {
  var job_event = JSON.parse(message.body);
  var job_id = job_event.jobEvent.jobId;

  function isEndEvent() {
    return "JOB_ENDED" === job_event.jobEvent.eventName;
  }

  if ($('#' + job_id).length) {
    if (isEndEvent()) {
      removeJob(
          job_id
          , new Date(parseInt(job_event.jobEvent.data.execution_start_time)) // I'm cheating.  This is NOT the submission time
          , new Date(parseInt(job_event.jobEvent.data.execution_end_time)) 
          , job_event.jobEvent.data.job_status
          );
    } else {
      updateJob(job_event);
    }
  } else if (!isEndEvent()) {
    addJob(job_id
        , new Date(parseInt(job_event.jobEvent.timeStamp))
        , job_event.jobEvent.eventName
        );
  }

  var events_id = jobEventsId(job_id);
  console.log(events_id);
  var job_events = $('#' +  events_id);
  if (job_events.length) {
    console.log("Adding job event");
    job_events.append("<p class='event'>" + js_beautify(JSON.stringify(message.body, null, 2)) + "</p><hr>");
  }
}

function processJobSummary(message) {
  var job_summary = JSON.parse(message.body);
  setMetrics(job_summary);
}

function setMetrics(job_summary) {
  if (typeof job_summary === 'undefined')
    return;
  $('#cm-anch').text(job_summary.successful);
  $('#fm-anch').text(job_summary.failed);
  $('#rm-anch').text(job_summary.running);
  $('#qm-anch').text(job_summary.queued);
}
