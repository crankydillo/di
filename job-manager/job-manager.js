var url_base = "http://localhost";

$(document).ready(function(){

  $('#abort-confirm').hide();

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

    // I don't like this business.  Can we just spin off a function that will
    // set the label.  Then again, how do we not do that too often?
    var run_or_queued_jobs = [];

    var proc_job_event_fn = function(message) {
        processJobEvent(message, run_or_queued_jobs);
    }

    var onconnect = function(frame) {
      console.log("connected to Stomp");

      client.send("/topic/stomp.websocket.keepalive");
      setInterval(
        function() {
            client.send("/topic/stomp.websocket.keepalive");
        }, 2 * 60 * 1000
      );

      client.subscribe(job_summary_destination, processJobSummary);
      client.subscribe(job_event_destination, proc_job_event_fn);
      client.heartbeat.outgoing = 20000;
      client.heartbeat.incoming = 0;

    };
   
    //var host = window.location.host; 
    var host = "localhost"
    console.log("host: " + host);
    var url = 'ws://' + host + ':61614/stomp';
    var login = 'guest';
    var passcode = 'guest';
    job_event_destination = '/topic/job.topic';
    job_summary_destination = '/topic/summary.topic';

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
  var oneDayAgo = new Date(new Date() - 0);//24 * 60 * 60 * 1000);
  $.get(url_base + '/di/services/batch/jobs/overview?period=HOUR&since=' +
          oneDayAgo.toISOString()
      , function(xml) { setMetrics(xml); }
      , 'xml');
}

function getJobs() {
  $.get(url_base + '/di/services/batch/jobs?verbose=true&last=' + 0//(8 * 60 * 60) 
      , function(xml) { 
        var fst = 0;
        $('job', xml).each(function(i) {
          var job_href = $(this).attr("xlink:href");
          var job_id = job_href.split("/").pop();

          var job_id = job_href.split("/").pop();

          var start_date = parseIsoToDate($(this).find("submissionDate").text());

          var end_date;
          var maybe_end_date = $(this).find("endDate");
          if (maybe_end_date.length)
            end_date = parseIsoToDate(maybe_end_date.text());

          var statuss = $(this).find("status").text();

          /*
          var pkg_name = $(this).find("pkgName").text();
          var pkg_ver = $(this).find("pkgVersion").text();
          */

          if (typeof end_date === "undefined") {
            if (statuss === 'QUEUED')
                statuss = 'JOB_QUEUED';
            addJob(job_id, start_date, statuss);
          } else {
            addLogRow(job_id, start_date, end_date, statuss, false);
          }
        });
      }, 'xml');
}

function addLogTab(job_id, statuss) {
    var statusImg = "<img width='35' height='35' src='" + statusIcon(statuss) + "'/>";
    var content = 
        $("<div id='log_'" + job_id + "'>" + 
            "<div style='font-size:18px; font-weight: bold;'>" + job_id + " Log&nbsp;&nbsp;" + statusImg + "</div>" +
            "<br/><br/><p>Loading <img width='30' height='30' src='images/spinner.gif'/></p></div>");

    attachLog(job_id, content);

    addTab(
            logTabId(job_id)
            , "Log"
            , content
          );
}

function logTabId(jobId) {
  return "tl_" + jobId;
}

// Retrieve the job log from the server
// TODO Make this async
function attachLog(job_id, content) {
  $.ajax({
    url: url_base + '/di/services/batch/jobs/' + job_id + '/log'
    , type: "get"
    //, async: false
    , async: true
    , success: function(text) {
        content.children('p').remove();
        content.append(
            text.replace(/([^>\r\n]?)(\r\n|\n\r|\r|\n)/g, '$1<br/><br/>$2')
            );
    }, error: function(jqHXR, respCode, errorThrown) {
        content.append("Could not retrieve log.");
    }
  });
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

function addJob(job_id, start_date, event_name) {
    var interval_id = setInterval(function() {
        updateDuration(job_id);
    }, 1000);
    if ($('#' + job_id).length > 0)
        return;
    addJobRow(job_id, start_date, event_name, interval_id);
}

function addLogRow(job_id, start_date, end_date, statuss, prepend) {
  var id = "rep_" + job_id;
  var row = $(
    "<tr class='r_" + statuss + "'>" +
      "<td><a id='" + id + "' href='#blah'>" + 
      "Loading <img width='30' height='30' src='images/spinner.gif'/></td>" +
      "<td>" + formatTime(start_date) + "</td>" +
      "<td>" + formatTime(end_date) + "</td>" +
      "<td><img width='35' height='35' src='" + statusIcon(statuss) + "'/></td>" +
    "</tr>"
    ).click( function() {
      addLogTab(job_id, statuss);
      $("#tabs").tabs('select', logTabId(job_id));
    });

  if (prepend === true) {
    $('#histheader').after(row);
  } else {
    $('#report').append(row);
  }
  packageLabel(job_id, id);
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
    var id = jobRowId(job_id);
  var row = $(
      "<tr id='" + job_id + "' class='r_" + event_name + "'>" +
      "<td><a id='" + id + "' href='#'" + id + ">" + 
      "Loading <img width='30' height='30' src='images/spinner.gif'/></td>" +
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
  packageLabel(job_id, id);
}

function packageLabel(job_id, id) {
  $.ajax({
    url: url_base + '/di/services/batch/jobs/' + job_id + '/rtc'
    , type: "get"
    , success: function(json) {
      $('#' + id).html(
        json.runtimeConfig.packageName + " " + 
        json.runtimeConfig.packageVersion
        );
    }, error: function(jqHXR, respCode, errorThrown) {
    }
  });
}

function jobTabSpinnerId(job_id) {
  return 'jrt-sp-' + job_id;
}

function removeJobTabSpinner(job_id) {
  var job_tab_spinner = $('#' + jobTabSpinnerId(job_id));
  if (job_tab_spinner.length !== 0)
    job_tab_spinner.html("<span>&nbsp;&nbsp</span>");
  // TODO Replace &nbsp with blank img or whatever that reliably replaces the spinner
}

function addJobTab(job_id) {
  var title_id = 'et_' + job_id;
  var events_id = jobEventsId(job_id);

  var stop_button = 
    $("<div id='jt_'" + job_id + "'>" +
        "<img style='cursor: pointer;' width='42' height='42' src='images/stop-sign.gif'/>" +
        "</div>"
     ).click(function() {
      $( "#abort-confirm" ).dialog({
        resizable: false
        , height:140
        , modal: true
        , width: 'auto'
        , height: 'auto'
        , buttons: {
          "Submit Abort": function() {
            submitAbort(job_id);
            $( this ).dialog( "close" );
          }, Cancel: function() {
            $( this ).dialog( "close" );
          }
        }
      });
    });

  var content_title = 
    $("<div style='width=50%; font-size:18px; font-weight: bold'>" +
    "<span id='" + title_id + "' style=''>" +
    "Loading <img width='30' height='30' src='images/spinner.gif'/>" +
    "</span>&nbsp;<span>Events&nbsp</span>" +
    "</div>"
     );

  var tab_title = "Job&nbsp;" + 
    "<span id='" + jobTabSpinnerId(job_id) +
    "'><img width='30' height='30' src='images/spinner.gif'/></span>";

  var wrapper = 
    $("<div/>")
    .append(content_title)
    .append($('<br/>'))
    .append(stop_button)
    .append($('<br/>'));

  var job_events = $("<div id='" + events_id + "'/>");
  var content = wrapper.append(job_events);
  addTab(jobTabId(job_id), tab_title, content);

  var job_row = $('#' + jobRowId(job_id));
  if (job_row.children('img').length === 0) {
    $('#' + title_id).html(job_row.html());
  } else {
    packageLabel(job_id, title_id);
  }
  // TODO When the end event is received, convert the stop sign
}

function jobRowId(job_id) {
  return 'jr_' + job_id;
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

function processJobEvent(message, run_or_queued_jobs) {
  // There are substantial hurdles with this.  Jobs can produce a huge amount of
  // events. Javascript in the browser has gotten much faster, but I'm not sure
  // that it's (yet) equipped to handle something like this.
  var job_event = JSON.parse(message.body);
  var job_id = job_event.jobEvent.jobId;

  var is_end_event = "JOB_ENDED" === job_event.jobEvent.eventName;

  if (contains(run_or_queued_jobs, job_id)) {
    if (is_end_event) {
      run_or_queued_jobs.splice(run_or_queued_jobs.indexOf(job_id), 1);
      removeJobTabSpinner(job_id);
      removeJob(
          job_id
          , new Date(parseInt(job_event.jobEvent.data.execution_start_time)) // I'm cheating.  This is NOT the submission time
          , new Date(parseInt(job_event.jobEvent.data.execution_end_time)) 
          , job_event.jobEvent.data.job_status
          );
    } else {
      updateJob(job_event);
    }
  } else if (!is_end_event) {
      run_or_queued_jobs.push(job_id);
      addJob(job_id
        , new Date(parseInt(job_event.jobEvent.timeStamp))
        , job_event.jobEvent.eventName
        );
  }

  var events_id = jobEventsId(job_id);
  var job_events = $('#' +  events_id);
  if (job_events.length) {
    var job_event = JSON.parse(message.body);
    job_event.jobEvent.date = new Date(job_event.jobEvent.timeStamp).toLocaleString();
    job_events.append("<p class='event'><pre>" + 
        js_beautify(JSON.stringify(job_event, null, 2)) +
        "</pre></p><hr>"
        );
  }
}

function processJobSummary(message) {
  var job_summary = JSON.parse(message.body);
  setMetrics(job_summary);
}

function setMetrics(job_summary) {
  if (typeof job_summary === 'undefined')
    return;

  var summary_elem = $(job_summary).find("summary");
  
  function extract(name) {
      return $(summary_elem).find(name).text();
  }
  $('#cm-anch').text(extract("successful"));
  $('#fm-anch').text(extract("failed"));
  $('#rm-anch').text(extract("currentlyRunning"));
  $('#qm-anch').text(extract("currentlyQueued"));
}

function submitAbort(job_id) {
  $.ajax({
    url: url_base + '/di/services/batch/jobs/' + job_id
    , type: "delete"
    , async: true
    , error: function(jqHXR, respCode, errorThrown) {
      alert("There was a problem with the abort!");
    }
  });
}
