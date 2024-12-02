jQuery(document).ready(function ($) {
    "use strict";

    var wpsiScreensizeHideColumn = 768;
    var wpsiScreensizeLowerMobile = 480;
    var wpsiMobileRowCount = 5;
    var wpsiDefaultRowCount = 7;
    var wpsiDefaultPagingType = 'simple_numbers';
    var wpsiMobilePagingType = 'simple';
    var ignoreBtn = $('#wpsi-ignore-selected');
    var deleteBtn = $('#wpsi-delete-selected');
    var lastSelectedPage = 0;

    $(window).on('resize', function(){
        wpsi_resize_datatables();
    });

    /**
     * Hide columns based on screen size, and redraw
     */
    function wpsi_resize_datatables() {
        $('.item-content').each(function () {
            if ($(this).closest('.wpsi-item').hasClass('wpsi-load-ajax')) {
                var table = $(this).find('table').DataTable();
                var column = table.column(2);
                var win = $(window);
                if (win.width() > wpsiScreensizeHideColumn) {
                    if (!column.visible()) column.visible(true);
                } else {
                    column.visible(false);
                }
                table.columns.adjust().draw();

                //for mobile, we lower the number of rows
                if (win.width() < wpsiScreensizeLowerMobile) {
                    table.page.len(wpsiMobileRowCount).draw();

                } else {
                    table.page.len(wpsiDefaultRowCount).draw();
                }
            }

        });
    }

    /**
     * Ajax loading of tables
     */

    window.wpsiLoadAjaxTables = function() {
        $('.item-content').each(function () {
            if ($(this).closest('.wpsi-item').hasClass('wpsi-load-ajax')) {
                wpsiLoadData($(this), 1, 0);
            }
        });
    };

    window.wpsiLoadAjaxTables();
    function wpsiInitSingleDataTable(container) {
        var table = container.find('.wpsi-table');
        var win = $(window);
        var pageLength = wpsiDefaultRowCount;
        var pagingType = wpsiDefaultPagingType;

        var columnVisible = true;
        if (win.width() < wpsiScreensizeHideColumn) {
            columnVisible = false;
        }
        var columnTwoDef = '{ "visible": '+columnVisible+',  "targets": [ 2 ] }';
        if (win.width() < wpsiScreensizeLowerMobile) {
            pageLength = wpsiMobileRowCount;
            pagingType = wpsiMobilePagingType;
        }
        table.DataTable( {
            "dom": 'frt<"table-footer"p<"wpsi-page-nr">><"clear">B',
            "pageLength": pageLength,
            "pagingType": pagingType,
            "stateSave": true,
            "columns": [
                { "width": "15%" },
                { "width": "5%" },
                { "width": "12%" },
                { "width": "" },
                { "width": "15%" },
            ],
            "columnDefs": [
                { "visible": false,  "targets": [ 3 ] },
                { "visible": columnVisible,  "targets": [ 2 ] },
                { "iDataSort": 3, "aTargets": [ 2] },
                columnTwoDef,
                { "targets": [1,2,3,4], "searchable": false } //search only on first column
            ],
            buttons: [
                //{extend: 'csv', text: 'Download CSV'}
            ],
            conditionalPaging: true,
            "language": {
                "paginate": {
                    "previous": wpsi.localize['previous'],
                    "next": wpsi.localize['next'],
                },
                searchPlaceholder: wpsi.localize['search'],
                "search": "",
                "emptyTable": wpsi.localize['no-searches']
            },
            "order": [[2, "desc"]],
        });

        container.find('.wpsi-table').on( 'page.dt', function () {
            var table = $(this).closest('table').DataTable();
            var info = table.page.info();
            lastSelectedPage = info.page;
            if (win.width() < wpsiScreensizeLowerMobile) {
                // +1 because it starts counting at 0
                var currentPage = lastSelectedPage +1;
                $(".wpsi-page-nr").text(currentPage + "/" + info.pages);
            }
        } );
    }


    function localize_html(str) {
        var strings = wpsi.localize;
        for (var k in strings) {
            if (strings.hasOwnProperty(k)) {
                if ( k === str ) return strings[k];
            }
        }
        return str;
    }


    function wpsiLoadData(container, page, received){
        var type = container.closest('.wpsi-item').data('table_type');
        if(page===1) container.html(wpsi.skeleton);
        var unixStart = localStorage.getItem('wpsi_range_start');
        var unixEnd = localStorage.getItem('wpsi_range_end');
        if (unixStart === null || unixEnd === null ) {
            unixStart = moment().subtract(1, 'week').unix();
            unixEnd = moment().unix();
            localStorage.setItem('wpsi_range_start', unixStart);
            localStorage.setItem('wpsi_range_end', unixEnd);
        }
        unixStart = parseInt(unixStart);
        unixEnd = parseInt(unixEnd);
        $.ajax({
            type: "GET",
            url: wpsi.ajaxurl,
            dataType: 'json',
            data: ({
                action : 'wpsi_get_datatable',
                start  : unixStart,
                end    : unixEnd,
                page   : page,
                type   : type,
                token  : wpsi.token
            }),
            success: function (response) {
                //this only on first page of table
                if (page===1){
                    container.html(response.html);
                    if (type==='all') {
                        wpsiInitSingleDataTable(container);
                        wpsiInitDeleteCapability();
                        wpsiInitIgnoreCapability();
                    }
                } else {
                    var table = container.find('table').DataTable();
                    var rowCount = response.html.length;
                    for (var key in response.html) {
                        if (response.html.hasOwnProperty(key)) {
                            var row = $(response.html[key]);
                            //only redraw on last row
                            if (parseInt(key) >= (rowCount-1) ) {
                                table.row.add(row).draw();
                                table.page( lastSelectedPage ).draw( false )
                            } else {
                                table.row.add(row);
                            }
                        }
                    }
                }

                received += response.batch;
                if (response.total_rows > received) {
                    page++;
                    wpsiLoadData(container, page , received);
                } else {
                    page = 1;
                }

            }
        });
    }


    /**
     * select and delete functions
     */
    function wpsiInitDeleteCapability() {
        //move button to location in table
        $(".table-footer").append(deleteBtn);
        deleteBtn.show();

        //set button to disabled
        $('#wpsi-delete-selected').attr('disabled', true);
        $('#wpsi-ignore-selected').attr('disabled', true);

        $('.dataTable tbody').on('click', 'tr', function (event) {
            $('#wpsi-delete-selected').attr('disabled', true);
            $('#wpsi-ignore-selected').attr('disabled', true);
            if ($(this).hasClass('wpsi-selected')) {
                $(this).removeClass('wpsi-selected');
            } else {
                $(this).addClass('wpsi-selected');
            }

            //if at least one row is selected, enable the delete button
            var table = $(this).closest('.item-content').find('.dataTable');
            table.find('.wpsi-selected').each(function () {
                $('#wpsi-delete-selected').attr('disabled', false);
                $('#wpsi-ignore-selected').attr('disabled', false);
            });

        });

        $(document).on('click', '#wpsi-delete-selected', function () {
            var termIDs = [];

            $('.dataTable').each(function () {
                var table = $(this);
                //get all selected rows
                table.find('.wpsi-selected').each(function () {
                    var row = $(this);
                    termIDs.push($(this).find('.wpsi-term').data('term_id'));
                    row.css('background-color', '#d7263d2e');
                });

            });

            $.ajax({
                type: "POST",
                url: wpsi.ajaxurl,
                dataType: 'json',
                data: ({
                    action: 'wpsi_delete_terms',
                    term_ids: JSON.stringify(termIDs),
                    token: wpsi.token
                }),
                success: function (response) {
                    //get all occurrences on this page for this term id
                    $('.dataTable').each(function () {
                        var table = $(this).DataTable();
                        while ($('.wpsi-selected').length) {
                            table.row('.wpsi-selected').remove().draw(false);
                        }
                    });
                    $('#wpsi-delete-selected').attr('disabled', true);
                    $('#wpsi-ignore-selected').attr('disabled', true);
                }
            });
        });
    }

    /**
     * select and delete functions
     */
    function wpsiInitIgnoreCapability() {
        //move button to location in table
        $(".table-footer").append(ignoreBtn);
        ignoreBtn.show();

        //set button to disabled
        $('#wpsi-ignore-selected').attr('disabled', true);

        $(document).on('click', '#wpsi-ignore-selected', function () {
            var termIDs = [];

            $('.dataTable').each(function () {
                var table = $(this);
                //get all selected rows
                table.find('.wpsi-selected').each(function () {
                    var row = $(this);
                    termIDs.push($(this).find('.wpsi-term').data('term_id'));
                    row.css('background-color', '#d7263d2e');
                });

            });

            $.ajax({
                type: "POST",
                url: wpsi.ajaxurl,
                dataType: 'json',
                data: ({
                    action: 'wpsi_ignore_terms',
                    term_ids: JSON.stringify(termIDs),
                    token: wpsi.token
                }),
                success: function (response) {
                    //get all occurrences on this page for this term id
                    $('.dataTable').each(function () {
                        var table = $(this).DataTable();
                        while ($('.wpsi-selected').length) {
                            table.row('.wpsi-selected').remove().draw(false);
                        }
                    });
                    $('#wpsi-delete-selected').attr('disabled', true);
                    $('#wpsi-ignore-selected').attr('disabled', true);
                }
            });
        });
    }

    /**
     * Export
     */

    $(document).on('click', '#wpsi-start-export', wpsiExportData);
    if (wpsi.export_in_progress){
        wpsiExportData();
    }

    function wpsiExportData(){
        var downloadContainer = $('.wpsi-download-link');
        var button = $('#wpsi-start-export');

        var unixStart = localStorage.getItem('wpsi_range_start');
        var unixEnd = localStorage.getItem('wpsi_range_end');
        if (unixStart === null || unixEnd === null ) {
            unixStart = moment().subtract(1, 'week').unix();
            unixEnd = moment().unix();
            localStorage.setItem('wpsi_range_start', unixStart);
            localStorage.setItem('wpsi_range_end', unixEnd);
        }
        unixStart = parseInt(unixStart);
        unixEnd = parseInt(unixEnd);
        button.prop('disabled', true);
        $.ajax({
            type: "GET",
            url: wpsi.ajaxurl,
            dataType: 'json',
            data: ({
                action: 'wpsi_start_export',
                date_from: unixStart,
                date_to: unixEnd,
                token: wpsi.token,
            }),
            success: function (response) {
                if (response.percent < 100) {
                    downloadContainer.html(response.percent+'%');
                    wpsiExportData();
                } else {
                    var link = '<div><a href="'+response.path+'">'+wpsi.strings['download']+'</a></div>';
                    downloadContainer.html(link);
                    button.prop('disabled', false);
                }
            }
        });
    }


    /**
     * Set hover on tips tricks
     */

    $(".wpsi-tips-tricks-element a").hover(function() {
        $(this).find('.wpsi-bullet').css("background-color","#d7263d");
    }, function() {
        $(this).find('.wpsi-bullet').css("background-color",""); //to remove property set it to ''
    });
});

